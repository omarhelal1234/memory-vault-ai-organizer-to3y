import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

interface AnalyzeRequest {
  memoryId: string;
  type: 'screenshot' | 'voice_memo' | 'photo' | 'video' | 'link';
  mediaUrl: string;
}

serve(async (req) => {
  try {
    const { memoryId, type, mediaUrl }: AnalyzeRequest = await req.json();

    // Update status to processing
    await supabase
      .from('memories')
      .update({ processing_status: 'processing' })
      .eq('id', memoryId);

    let analysis: any = {};
    const startTime = Date.now();

    if (type === 'screenshot' || type === 'photo') {
      // Use GPT-4 Vision for image analysis
      const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and provide: 1) Detected objects/content, 2) Any visible text (OCR), 3) Scene description, 4) Suggested categories from: Movies to Watch, GitHub Repos, AI News, Recipes, Travel Ideas, Shopping, Health, Finance, Other. 5) Suggested tags. Return as JSON.',
              },
              {
                type: 'image_url',
                image_url: { url: mediaUrl },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0].message.content!);
      analysis = {
        detected_objects: result.objects || [],
        detected_text: result.text || null,
        scene_description: result.description || null,
        suggested_categories: result.categories || [],
        suggested_tags: result.tags || [],
        confidence: result.confidence || 0.8,
      };
    } else if (type === 'voice_memo') {
      // Use Whisper for audio transcription
      const audioResponse = await fetch(mediaUrl);
      const audioBlob = await audioResponse.blob();

      const transcription = await openai.audio.transcriptions.create({
        file: audioBlob,
        model: 'whisper-1',
      });

      // Categorize transcription
      const categorizationResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: `Categorize this voice memo transcript: "${transcription.text}". Return JSON with: category, tags, description, confidence.`,
          },
        ],
        max_tokens: 300,
      });

      const result = JSON.parse(categorizationResponse.choices[0].message.content!);
      analysis = {
        transcription: transcription.text,
        suggested_categories: [result.category],
        suggested_tags: result.tags || [],
        confidence: result.confidence || 0.75,
      };
    }

    const processingTime = Date.now() - startTime;

    // Save AI analysis
    const { data: aiAnalysis } = await supabase
      .from('ai_analyses')
      .insert({
        memory_id: memoryId,
        ...analysis,
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    // Auto-assign categories
    if (analysis.suggested_categories && analysis.suggested_categories.length > 0) {
      const categoryName = analysis.suggested_categories[0];
      const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('name', categoryName)
        .single();

      if (category) {
        await supabase.from('memory_categories').insert({
          memory_id: memoryId,
          category_id: category.id,
        });
      }
    }

    // Update memory status
    await supabase
      .from('memories')
      .update({ processing_status: 'completed' })
      .eq('id', memoryId);

    return new Response(JSON.stringify({ success: true, analysis: aiAnalysis }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Analysis error:', error);

    // Update memory with error
    const { memoryId } = await req.json();
    await supabase
      .from('memories')
      .update({
        processing_status: 'failed',
        processing_error: error.message,
      })
      .eq('id', memoryId);

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
