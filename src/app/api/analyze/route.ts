import { NextRequest, NextResponse } from 'next/server';

// 🚨 IMPORTANT: This URL is now the single endpoint of your new unified Cloud Function
const EXTERNAL_API_ENDPOINT = "https://web-segregation-api-1087940626963.asia-south2.run.app";

export async function POST(request: NextRequest) {
  try {
    // 1. Get Form Data (This is correct for receiving from your frontend)
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const analysisType = formData.get('type') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!analysisType || !['segregation', 'fullness'].includes(analysisType)) {
      return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }

    // 2. Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // 3. Prepare JSON payload for the single Python endpoint
    // The Python function expects 'image' and 'analysis_type'
    const payload = {
      image: base64Image,
      analysis_type: analysisType
      // Note: If you need to send 'category' for the 'fullness' check, 
      // your frontend logic needs to call this route twice and send the category 
      // in the second request, but this current route doesn't support that multi-step flow.
    };

    // 4. Call the external Cloud Function API
    // Ensure the Content-Type is application/json as expected by Python
    const response = await fetch(EXTERNAL_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // Fetch the error body from the API response for detailed logging
      const errorBody = await response.text(); 
      throw new Error(`External API error! Status: ${response.status}. Details: ${errorBody.substring(0, 200)}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      analysisType,
      ...result
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
