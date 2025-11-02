import { NextRequest, NextResponse } from 'next/server';

const EXTERNAL_API_ENDPOINT = "https://web-segregation-api-1087940626963.asia-south2.run.app";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const analysisType = formData.get('type') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!analysisType || !['segregation', 'fullness'].includes(analysisType)) {
      return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }

    // Convert file to base64 for the external API
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Prepare payload for external API
    const payload = {
      image: base64Image,
      analysis_type: analysisType
    };

    // Call the external Cloud Function API
    const response = await fetch(EXTERNAL_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`External API error! Status: ${response.status}`);
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


