# Fix Employee Photo Upload

## What's wrong

Employee photos never save because the storage location they upload to does not exist. The app writes employee photos to an `employee-photos` bucket, but the backend only has buckets for company logos, lead, project and task attachments. Every upload fails, so the photo silently stays empty and the avatar keeps showing initials. Confirmed: all employee records currently have an empty photo value.

A second issue: the upload writes files to a flat path with no company folder, so even after creating the bucket there would be no way to keep one company's photos separate from another's.

## What will change

1. Create a private `employee-photos` storage bucket.
2. Store each file under the company's own folder so photos are isolated per company, and access rules allow:
   - anyone signed in to the company to view its employee photos,
   - admins/managers of that company to upload, replace and remove them.
3. Update the employee edit form to upload into the company folder, and to show a clear error message if an upload fails instead of failing quietly.
4. When a photo is replaced or removed, delete the old file so orphaned images don't pile up.
5. Keep the existing display behaviour (short-lived signed link, initials fallback) unchanged.

## Technical notes

- New bucket `employee-photos` (private) created via the storage bucket tool; RLS policies on `storage.objects` in a migration, scoped by `(storage.foldername(name))[1] = current_company_id()::text`, mirroring the `company-logos` pattern.
- `src/components/app/EditEmployeeModal.tsx`: `handlePhotoUpload` path becomes `${companyId}/${uuid}.${ext}`; add remove/replace cleanup via `storage.remove`.
- `src/components/app/EmployeePhoto.tsx` stays as-is (already resolves paths to signed URLs).

## Verification

Upload a photo for an employee, save, reload the Employees page and confirm the photo shows in both grid and table views, and that no error toast appears.
