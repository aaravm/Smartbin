# main.py

import functions_framework
import base64
import json
import os 
import traceback
from google.cloud import vision
from google.cloud import firestore
# These imports are needed for the estimate_bin_fill_api logic (Gemini)
from google.cloud import aiplatform 
from vertexai.generative_models import GenerativeModel, Part, Content
# FIX: Correct import path for types needed for explicit configuration object construction
from google.cloud.aiplatform_v1.types import types as aiplatform_types


# --- 1. CONFIGURATION ---
# Read configuration from standard environment variables (best practice for Cloud Functions/Run)
PROJECT_ID = os.environ.get("GCP_PROJECT", "smart-waste-segregation-476313")
REGION = os.environ.get("FUNCTION_REGION", "asia-south2") 
LOG_COLLECTION_NAME = u'web_waste_segregation_data'
BIN_STATUS_COLLECTION = u'bin_status' 
ALERT_THRESHOLD = 90.0

SEGREGATION_RULES = {
    'plastic': 'PLASTIC', 'bottle': 'PLASTIC', 'container': 'PLASTIC',
    'paper': 'PAPER', 'cardboard': 'PAPER',
    'banana': 'ORGANIC', 'food': 'ORGANIC', 'fruit': 'ORGANIC',
    'can': 'METAL', 'tin': 'METAL',
    'glass': 'GLASS', 'jar': 'GLASS', 'cup': 'GLASS',
}

# --- 2. Initialize Clients (Global Scope) ---
# Initialization is resource-heavy; this causes the timeout error.
vision_client = None
firestore_client = None
gemini_model = None

try:
    # Use explicit region/project when initializing clients
    vision_client = vision.ImageAnnotatorClient()
    firestore_client = firestore.Client(project=PROJECT_ID)
    
    # Initialize the Vertex AI SDK and Gemini model for the fullness check
    aiplatform.init(project=PROJECT_ID, location=REGION)
    gemini_model = GenerativeModel("gemini-2.5-flash") 

except Exception as e:
    # This block ensures that if the service fails to start, we capture the reason.
    print(f"--- CLIENT INITIALIZATION FAILED ---")
    print(f"Configuration: Project={PROJECT_ID}, Region={REGION}")
    print(f"Detailed Error: {e}")
    print(traceback.format_exc())


# --- 3. Gemini Prompt for Structured Output (Utility Function) ---
def generate_gemini_prompt(bin_image_bytes):
    # Fix from previous turns: Use dict structure to avoid problematic factory methods
    base64_encoded_image = base64.b64encode(bin_image_bytes).decode('utf-8')
    
    bin_part = Part.from_dict({
        "inline_data": {
            "data": base64_encoded_image,
            "mime_type": "image/jpeg"
        }
    })
    
    system_instruction = (
        "You are an expert waste level estimator. Analyze the image and determine the fill percentage "
        "of the dustbin shown. The output MUST be a single, valid JSON object with ONLY two keys: "
        "'fill_percentage' (a number 0 to 100, use whole numbers or one decimal place) and 'reason' (a brief justification)."
    )

    prompt = (
        "Analyze the interior of the waste bin in the image. Estimate the current fill level as a single number (percentage) from 0 to 100. "
        "Output ONLY the requested JSON object."
    )
    
    return [
        Content(parts=[Part.from_text(system_instruction)]),
        Content(parts=[bin_part, Part.from_text(prompt)])
    ]


# --- 4. Logic Handlers ---

def handle_segregation(image_bytes, headers):
    """Handles waste classification via Cloud Vision API."""
    if vision_client is None:
        return json.dumps({"status": "Error", "message": "Vision client failed to initialize."}), 500, headers
    
    vision_image = vision.Image(content=image_bytes)
    vision_response = vision_client.label_detection(image=vision_image)
    labels = vision_response.label_annotations
    
    detected_labels = [label.description.lower() for label in labels]
    highest_confidence = labels[0].score if labels else 0.0
    segregated_category = next((category for label in detected_labels for keyword, category in SEGREGATION_RULES.items() if keyword in label), "UNCATEGORIZED")
    
    return json.dumps({
        "status": "Success",
        "message": f"Waste classified as {segregated_category}.",
        "segregated_category": segregated_category,
        "detected_labels": detected_labels[:5],
        "confidence": round(highest_confidence, 4)
    }), 200, headers

def handle_fullness(image_bytes, headers):
    """Handles bin fill estimation via Gemini, and updates/logs Firestore data."""
    if firestore_client is None:
        return json.dumps({"status": "Error", "message": "Firestore client failed to initialize. Check logs."}), 500, headers

    def vision_fallback_estimate(image_bytes):
        """Simple heuristic fallback using Cloud Vision labels when Gemini is unavailable."""
        try:
            vision_image = vision.Image(content=image_bytes)
            vision_response = vision_client.label_detection(image=vision_image)
            labels = vision_response.label_annotations or []
            detected = [lbl.description.lower() for lbl in labels]
            top_score = labels[0].score if labels else 0.0

            # Keyword-driven heuristics
            heuristics = {
                'empty': 5.0,
                'almost empty': 5.0,
                'half': 50.0,
                'half-full': 50.0,
                'full': 95.0,
                'almost full': 90.0,
                'overflow': 98.0,
                'overflowing': 98.0,
                'trash': 60.0,
                'garbage': 60.0,
                'waste': 60.0,
            }
            for lbl in detected:
                for key, val in heuristics.items():
                    if key in lbl:
                        return float(val), f"Fallback vision heuristic matched label '{lbl}'."

            # If no obvious keywords, use top label confidence scaled to percentage
            estimated = min(100.0, max(5.0, top_score * 100.0))
            return float(estimated), f"Fallback vision confidence-based estimate ({top_score:.2f})."
        except Exception as e:
            print("Vision fallback failed:", e)
            return 0.0, "Fallback failed to produce an estimate."

    try:
        # Attempt Gemini-based estimation if model initialized
        current_fill_level = None
        gemini_reasoning = "No reasoning available."
        used_method = "none"

        if gemini_model is not None:
            try:
                gemini_contents = generate_gemini_prompt(image_bytes)
                # Try the expected API; some deployments may not support generate_content and will raise.
                gemini_response = gemini_model.generate_content(contents=gemini_contents)

                # Extract text safely (different SDK versions return different shapes)
                gemini_text = None
                if gemini_response is None:
                    gemini_text = None
                elif hasattr(gemini_response, "text"):
                    gemini_text = gemini_response.text
                elif isinstance(gemini_response, (list, tuple)) and len(gemini_response) > 0 and hasattr(gemini_response[0], "text"):
                    gemini_text = gemini_response[0].text
                elif isinstance(gemini_response, dict) and "text" in gemini_response:
                    gemini_text = gemini_response["text"]

                if not gemini_text:
                    raise ValueError("Gemini returned empty text.")

                gemini_output = json.loads(gemini_text)
                current_fill_level = float(gemini_output.get('fill_percentage', 0))
                gemini_reasoning = gemini_output.get('reason', 'Visual estimation provided by Gemini.')
                used_method = "gemini"

            except Exception as e:
                # If the Gemini endpoint is not implemented/enabled (501) or any error occurs, fallback to Vision heuristic.
                print("Gemini generation failed; falling back to Vision heuristic. Error:", e)
                current_fill_level, gemini_reasoning = vision_fallback_estimate(image_bytes)
                used_method = "vision_fallback"
        else:
            # Gemini not initialized — use Vision fallback
            print("Gemini model not initialized; using Vision fallback.")
            current_fill_level, gemini_reasoning = vision_fallback_estimate(image_bytes)
            used_method = "vision_fallback"

        alert_raised = current_fill_level >= ALERT_THRESHOLD
        segregated_category = "BIN_CHECK"

        # --- Log Transaction (Historical Record) ---
        log_data = {
            u'timestamp': firestore.SERVER_TIMESTAMP,
            u'segregated_category': segregated_category,
            u'bin_level_recorded': current_fill_level,
            u'alert_raised': alert_raised,
            u'gemini_reasoning': gemini_reasoning,
            u'status': 'Processed',
            u'method': used_method
        }
        # collection.add() return shape can vary across SDK versions; normalize it safely
        add_result = firestore_client.collection(LOG_COLLECTION_NAME).add(log_data)
        doc_ref = None
        try:
            if isinstance(add_result, (list, tuple)):
                # prefer the element that looks like a DocumentReference (has 'id' attribute)
                if len(add_result) > 0 and hasattr(add_result[0], "id"):
                    doc_ref = add_result[0]
                elif len(add_result) > 1 and hasattr(add_result[1], "id"):
                    doc_ref = add_result[1]
            elif hasattr(add_result, "id"):
                doc_ref = add_result
        except Exception:
            doc_ref = None

        # --- Update Live Bin Status ---
        bin_status_data = {
            u'level': current_fill_level,
            u'last_update': firestore.SERVER_TIMESTAMP,
            u'is_full': alert_raised,
            u'category': segregated_category,
            u'method': used_method
        }
        bin_ref = firestore_client.collection(BIN_STATUS_COLLECTION).document(segregated_category)
        bin_ref.set(bin_status_data)

        # --- Return Response to Web Client ---
        return json.dumps({
            "status": "Success",
            "message": f"Fill level recorded. Bin is {current_fill_level:.1f}% full.",
            "segregated_category": segregated_category,
            "bin_level": current_fill_level,
            "alert": alert_raised,
            "document_id": doc_ref.id if doc_ref is not None else None,
            "method_used": used_method,
            "reason": gemini_reasoning
        }), 200, headers

    except Exception as e:
        print(f"An unexpected error occurred in Fullness Function: {e}")
        return (json.dumps({
            "error": "Fill Estimation server-side error.",
            "details": str(e)
        }), 500, headers)


# =====================================================================
# UNIFIED ENTRY POINT
# ENTRY POINT: smart_waste_handler_api
# =====================================================================

@functions_framework.http
def smart_waste_handler_api(request):
    """
    Receives image and analysis type, then routes the request to the correct handler.
    """
    headers = {}
    if request.method == 'OPTIONS':
        preflight_headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, preflight_headers)
    headers['Access-Control-Allow-Origin'] = '*'

    try:
        request_json = request.get_json(silent=True)
        
        # Check for core payload requirements
        if not request_json or 'image' not in request_json or 'analysis_type' not in request_json:
             return (json.dumps({"error": "Missing image or analysis_type in payload."}), 400, headers)

        image_bytes = base64.b64decode(request_json['image'])
        analysis_type = request_json['analysis_type']
        
        if analysis_type == 'segregation':
            return handle_segregation(image_bytes, headers)
        
        elif analysis_type == 'fullness':
            # Note: For accurate multi-bin tracking, this should eventually include 
            # the bin type (e.g., PLASTIC) in the request payload.
            return handle_fullness(image_bytes, headers)
            
        else:
            return (json.dumps({"error": f"Invalid analysis type: {analysis_type}."}), 400, headers)


    except Exception as e:
        print(f"An unexpected error occurred in smart_waste_handler_api: {e}")
        return (json.dumps({
            "error": "General server error during request processing.",
            "details": str(e)
        }), 500, headers)
