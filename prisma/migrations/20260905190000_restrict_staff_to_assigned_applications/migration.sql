-- Staff have a dedicated workspace. Their broad read permissions are replaced
-- with only the catalog and application data needed to process assigned files.
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE slug = 'staff');

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
WHERE roles.slug = 'staff'
  AND permissions.code IN (
    'applications:read:any',
    'documents:read:any',
    'lenders:read',
    'products:read'
  )
ON CONFLICT DO NOTHING;

-- Remove legacy direct privileges that exposed admin-only modules. Existing
-- staff retain only actions that operate inside an assigned application.
DELETE FROM user_permissions
WHERE user_id IN (SELECT user_id FROM staff)
  AND permission_id NOT IN (
    SELECT id FROM permissions
    WHERE code IN (
      'applications:status:update',
      'applications:remarks:create',
      'applications:activity:create',
      'documents:upload:any',
      'documents:request',
      'documents:verify'
    )
  );
