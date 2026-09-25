import dotenv from 'dotenv';
import path from 'path';

// Load .env from root if available
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gibeljemxpogvqgdjipt.supabase.co',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpYmVsamVteHBvZ3ZxZ2RqaXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjI1NzUsImV4cCI6MjEwNTU5ODU3NX0.tIUGU_BDTYu7W656YZWqx4enTpMhOwrFS-H9QqkDw9o',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  redisUrl: process.env.REDIS_URL || '',
  qrRotationSeconds: parseInt(process.env.VITE_QR_ROTATION_SECONDS || '15', 10),
  defaultInstitutionId: process.env.VITE_DEFAULT_INSTITUTION_ID || '00000000-0000-0000-0000-000000000001',
};
