import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VisualWorkflowBuilder } from '@/components/admin/workflows/VisualWorkflowBuilder';
import AdminLayout from '@/components/admin/AdminLayout';

const AdminWorkflows: React.FC = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();

  return (
    <AdminLayout title="التدفقات المرئية">
      <VisualWorkflowBuilder
        workflowId={workflowId}
        onBack={() => navigate('/admin')}
      />
    </AdminLayout>
  );
};

export default AdminWorkflows;
