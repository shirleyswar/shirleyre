import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sql = `
    CREATE TABLE IF NOT EXISTS contract_deadlines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      deadline_date DATE NOT NULL,
      deadline_type TEXT NOT NULL CHECK (deadline_type IN ('inspection', 'financing', 'appraisal', 'title', 'survey', 'closing', 'custom')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'satisfied', 'extended', 'missed')),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS contract_deadlines_deal_id_idx ON contract_deadlines(deal_id);
  `

  // Try using rpc to execute SQL - need a helper function
  // Since we can't run DDL directly, check if table exists
  const { error: checkError } = await supabaseAdmin
    .from('contract_deadlines')
    .select('id')
    .limit(1)

  if (!checkError) {
    return NextResponse.json({ success: true, message: 'Table already exists' })
  }

  return NextResponse.json({ 
    success: false, 
    message: 'Table does not exist. Run this SQL in Supabase dashboard:', 
    sql 
  }, { status: 200 })
}
