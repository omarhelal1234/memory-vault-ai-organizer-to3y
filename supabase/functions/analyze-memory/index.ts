// Supabase Edge Function: analyze-memory
// Processes uploaded memories using OpenAI APIs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface Memory {
  id: string;
  type: string;
  storage_path?: string;
  url?: string;
  content_text?: string;
}

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get pending memories
    const { data: memories, error: fetchError } = await supabase
      .from('memories')
      .select('*')
      .eq('processing_status', 'pending')
      .limit(10);

    if (fetchError) throw fetchError;
    if (!memories || memories.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending memories to process' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process each memory
    const results = await Promise.all(
      memories.map(async (memory: Memory) => {
        try {
          // Update status to processing
          await supabase
            .from('memories')
            .update({ processing_status: 'processing' })
            .eq('id', memory.id);

          let aiMetadata = {};

          // Process based on type
          if (memory.type === 'screenshot' || memory.type === 'photo') {
            aiMetadata = await analyzeImage(memory, supabase);
          } else if (memory.type === 'voice_memo') {
            aiMetadata = await transcribeAudio(memory, supabase);
          } else if (memory.type === 'link') {
            aiMetadata = await analyzeLink(memory);
          }

          // Update memory with AI metadata
          await supabase
            .from('memories')
            .update({
              processing_status: 'completed',
              ai_metadata: aiMetadata,
            })
            .eq('id', memory.id);

          return { id: memory.id, status: 'success' };
        } catch (error) {
          // Mark as failed
          await supabase
            .from('memories')
            .update({ processing_status: 'failed' })
            .eq('id', memory.id);

          return { id: memory.id, status: 'failed', error: error.message };
        }
      })
    );

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function analyzeImage(memory: Memory, supabase: any) {
  // Download image from storage
  const { data: imageData, error } = await supabase.storage
    .from('memories')
    .download(memory.storage_path);

  if (error) throw error;

  // Convert to base64
  const arrayBuffer = await imageData.arrayBuffer();
  const base64Image = btoa(
    String.fromCharCode(...new Uint8Array(arrayBuffer))
  );

  // Call OpenAI Vision API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and provide: 1) A brief summary, 2) Suggested categories (Movies to Watch, GitHub Repos, AI News, Recipes, Travel Ideas, Shopping, Other), 3) Relevant tags. Return as JSON.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });

  const result = await response.json();
  const content = result.choices[0].message.content;

  // Parse JSON response
  try {
    return JSON.parse(content);
  } catch {
    return { summary: content, suggested_categories: ['Other'], suggested_tags: [] };
  }
}

async function transcribeAudio(memory: Memory, supabase: any) {
  // Download audio from storage
  const { data: audioData, error } = await supabase.storage
    .from('memories')
    .download(memory.storage_path);

  if (error) throw error;

  // Create form data for Whisper API
  const formData = new FormData();
  formData.append('file', audioData, 'audio.m4a');
  formData.append('model', 'whisper-1');

  // Call OpenAI Whisper API
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const result = await response.json();
  const transcript = result.text;

  // Categorize transcript
  const categorization = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Categorize this voice memo transcript: "${transcript}". Return JSON with: summary, suggested_categories, suggested_tags.`,
        },
      ],
      max_tokens: 300,
    }),
  });

  const categorizationResult = await categorization.json();
  const metadata = JSON.parse(categorizationResult.choices[0].message.content);

  return {
    ...metadata,
    transcript,
  };
}

async function analyzeLink(memory: Memory) {
  // For links, use URL and any existing content_text
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: `Categorize this link: ${memory.url}. Title: ${memory.content_text || 'Unknown'}. Return JSON with: summary, suggested_categories, suggested_tags.`,
        },
      ],
      max_tokens: 300,
    }),
  });

  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}