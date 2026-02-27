import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { VisualWorkflowBuilder } from '@/components/admin/workflows/VisualWorkflowBuilder';

const AdminWorkflows: React.FC = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();

  return (
    <VisualWorkflowBuilder
      workflowId={workflowId}
      onBack={() => navigate('/admin')}
    />
  );
};

export default AdminWorkflows;
