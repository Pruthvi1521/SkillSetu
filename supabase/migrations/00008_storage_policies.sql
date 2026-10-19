-- Migration: 00008_storage_policies.sql
-- Description: Private object storage buckets and access policies for worker and assessment evidence.

-- 1. Create Private Storage Buckets (if storage schema exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES 
          ('worker-evidence', 'worker-evidence', FALSE, 15728640, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
          ('assessment-evidence', 'assessment-evidence', FALSE, 31457280, ARRAY['image/jpeg', 'image/png', 'video/mp4'])
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 2. Storage Policies for worker-evidence
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "worker_evidence_upload" ON storage.objects;
        CREATE POLICY "worker_evidence_upload" ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'worker-evidence' AND
            (auth.uid())::text = (storage.foldername(name))[1]
        );

        DROP POLICY IF EXISTS "worker_evidence_read" ON storage.objects;
        CREATE POLICY "worker_evidence_read" ON storage.objects FOR SELECT TO authenticated
        USING (
            bucket_id = 'worker-evidence' AND (
                (auth.uid())::text = (storage.foldername(name))[1] OR
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() AND role IN ('reviewer', 'admin')
                ) OR
                EXISTS (
                    SELECT 1 FROM public.assessments a 
                    JOIN public.worker_declarations d ON a.declaration_id = d.id 
                    WHERE d.worker_id = (storage.foldername(name))[1]::UUID 
                    AND a.assessor_id = auth.uid()
                )
            )
        );

        -- Storage Policies for assessment-evidence
        DROP POLICY IF EXISTS "assessment_evidence_upload" ON storage.objects;
        CREATE POLICY "assessment_evidence_upload" ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'assessment-evidence' AND
            EXISTS (
                SELECT 1 FROM public.assessments a 
                WHERE a.id = (storage.foldername(name))[1]::UUID 
                AND a.assessor_id = auth.uid()
                AND a.status IN ('assigned', 'in_progress')
            )
        );

        DROP POLICY IF EXISTS "assessment_evidence_read" ON storage.objects;
        CREATE POLICY "assessment_evidence_read" ON storage.objects FOR SELECT TO authenticated
        USING (
            bucket_id = 'assessment-evidence' AND (
                EXISTS (
                    SELECT 1 FROM public.assessments a 
                    WHERE a.id = (storage.foldername(name))[1]::UUID 
                    AND (
                        a.assessor_id = auth.uid() OR 
                        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('reviewer', 'admin') OR
                        EXISTS (SELECT 1 FROM public.worker_declarations d WHERE d.id = a.declaration_id AND d.worker_id = auth.uid())
                    )
                )
            )
        );
    END IF;
END $$;
