import { createClient } from '@supabase/supabase-js';

// Configuration constants
const SUPABASE_URL = 'https://wptcattczgsrdqbnwbxn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwdGNhdHRjemdzcmRxYm53YnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NzA0NDgsImV4cCI6MjA4MTE0NjQ0OH0.lYOoqCul4M8wAejj2U6Ksv5clGTIe_m1X76YA-p6jBw';

// Create a single supabase client for interacting with your database
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
