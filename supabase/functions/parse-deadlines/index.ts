import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!

const SYSTEM_PROMPT = `You are a commercial real estate document parser. Extract all deadlines, dates, and time-sensitive obligations from this document.

Return ONLY a JSON array. No other text. No markdown. No explanation.

Each object in the array must have these fields:
- "label": string — descriptive name for the deadline (e.g., "Feasibility Review Period Expiration", "Closing Deadline", "Seller Property Info Delivery")
- "deadline_date": string or null — ISO date format "YYYY-MM-DD". If the deadline is relative (e.g., "20 days after title commitment received") and no specific date can be calculated, set to null.
- "deadline_type": string — one of: "inspection", "financing", "appraisal", "title", "survey", "closing", "custom"
- "notes": string — any relevant context. For relative deadlines with null dates, describe the trigger condition here (e.g., "20 days after the later of title commitment receipt and Survey Date"). For deadlines with extension rights, note the extension terms here.

Mapping guidance for deadline_type:
- Effective Date → "custom"
- Feasibility Review Period / Due Diligence / Inspection Period → "inspection"
- Title commitment, title review, title objections, cure period → "title"
- Survey deadline → "survey"
- Financing contingency → "financing"
- Appraisal contingency → "appraisal"
- Closing deadline → "closing"
- Anything else → "custom"

Include ALL dates and deadlines mentioned in the document. Do not skip any. If a deadline has extension rights, note the extension terms in the notes field but use the base date as the deadline_date.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const { deal_id, file_path } = await req.json()
    if (!deal_id || !file_path) {
      return json({ success: false, error: 'deal_id and file_path are required' }, 400)
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. Read the PDF from Supabase Storage
    const { data: fileData, error: storageErr } = await sb.storage
      .from('deal-documents')
      .download(file_path.replace(/^deal-documents\//, ''))

    if (storageErr || !fileData) {
      return json({ success: false, error: 'File not found in storage' })
    }

    // 2. Convert to base64
    const arrayBuf = await fileData.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuf)
    let binary = ''
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64 = btoa(binary)

    // 3. Send to Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [{
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          }, {
            type: 'text',
            text: 'Extract all deadlines from this document and return them as a JSON array.',
          }],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic error:', errText)
      return json({ success: false, error: 'Document parsing failed' })
    }

    const anthropicData = await anthropicRes.json()
    const rawContent = anthropicData?.content?.[0]?.text ?? ''

    // 4. Parse the JSON array from the response
    let deadlines: Array<{
      label: string
      deadline_date: string | null
      deadline_type: string
      notes: string
    }>

    try {
      // Strip markdown fences if present
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      deadlines = JSON.parse(cleaned)
      if (!Array.isArray(deadlines)) throw new Error('Not an array')
    } catch {
      console.error('JSON parse failed. Raw:', rawContent.slice(0, 500))
      return json({ success: false, error: 'Could not extract structured deadlines from document' })
    }

    // 5. Insert each deadline into contract_deadlines
    const now = new Date().toISOString()
    const inserts = deadlines.map(d => ({
      deal_id,
      label: d.label ?? 'Unnamed Deadline',
      deadline_date: d.deadline_date ?? null,
      deadline_type: [
        'inspection', 'financing', 'appraisal', 'title', 'survey', 'closing', 'custom',
        'contingency', 'psa_review', 'lease_review', 'psa_draft', 'lease_draft',
        'lease_execution', 'lease_deliverables',
      ].includes(d.deadline_type) ? d.deadline_type : 'custom',
      status: 'pending',
      notes: d.notes ?? null,
      created_at: now,
      updated_at: now,
    }))

    const { data: inserted, error: insertErr } = await sb
      .from('contract_deadlines')
      .insert(inserts)
      .select()

    if (insertErr) {
      console.error('Insert error:', insertErr)
      return json({ success: false, error: 'Failed to save deadlines: ' + insertErr.message })
    }

    return json({
      success: true,
      deadlines_created: inserts.length,
      deadlines: inserted,
    })

  } catch (e: unknown) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
