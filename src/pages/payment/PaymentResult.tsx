import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

type PaymentStatus = 'loading' | 'success' | 'failed' | 'pending';

const PaymentResult: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [transactionDetails, setTransactionDetails] = useState<{
    amount?: number;
    transactionId?: string;
    errorMessage?: string;
  }>({});

  useEffect(() => {
    const processPaymentResult = async () => {
      // Get payment result from URL parameters
      const paymentStatus = searchParams.get('status');
      const transactionId = searchParams.get('transaction_id');
      const orderId = searchParams.get('order_id');
      const amount = searchParams.get('amount');
      const errorCode = searchParams.get('error_code');
      const errorMessage = searchParams.get('error_message');

      console.log('Payment result params:', {
        paymentStatus,
        transactionId,
        orderId,
        amount,
        errorCode,
        errorMessage
      });

      setTransactionDetails({
        amount: amount ? parseFloat(amount) : undefined,
        transactionId: transactionId || orderId || undefined,
        errorMessage: errorMessage || undefined,
      });

      // Determine payment status
      if (paymentStatus === 'success' || paymentStatus === 'completed') {
        setStatus('success');
        
        // Update local wallet balance if needed
        if (orderId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Refresh profile data
            const { data: profile } = await supabase
              .from('profiles')
              .select('wallet_balance')
              .eq('user_id', user.id)
              .single();
            
            if (profile) {
              console.log('Updated wallet balance:', profile.wallet_balance);
            }
          }
        }
      } else if (paymentStatus === 'failed' || paymentStatus === 'error' || errorCode) {
        setStatus('failed');
      } else if (paymentStatus === 'pending') {
        setStatus('pending');
      } else {
        // Default to checking the order status from database
        if (orderId) {
          const { data: transaction } = await supabase
            .from('rider_wallet_transactions')
            .select('status, amount')
            .eq('id', orderId)
            .single();

          if (transaction) {
            setTransactionDetails(prev => ({
              ...prev,
              amount: transaction.amount
            }));
            
            if (transaction.status === 'completed') {
              setStatus('success');
            } else if (transaction.status === 'failed') {
              setStatus('failed');
            } else {
              setStatus('pending');
            }
          } else {
            setStatus('failed');
          }
        } else {
          setStatus('failed');
        }
      }
    };

    processPaymentResult();
  }, [searchParams]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold mb-2">جاري التحقق من الدفع...</h2>
            <p className="text-muted-foreground">يرجى الانتظار</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
              تمت العملية بنجاح!
            </h2>
            <p className="text-muted-foreground mb-4">
              تم إضافة الرصيد إلى محفظتك بنجاح
            </p>
            {transactionDetails.amount && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6 inline-block">
                <p className="text-sm text-muted-foreground">المبلغ المضاف</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {transactionDetails.amount.toLocaleString('en-US')} د.ع
                </p>
              </div>
            )}
            {transactionDetails.transactionId && (
              <p className="text-xs text-muted-foreground mb-6">
                رقم المعاملة: {transactionDetails.transactionId}
              </p>
            )}
          </div>
        );

      case 'failed':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
              فشلت العملية
            </h2>
            <p className="text-muted-foreground mb-4">
              {transactionDetails.errorMessage || 'حدث خطأ أثناء معالجة الدفع'}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              يرجى المحاولة مرة أخرى أو التواصل مع الدعم
            </p>
          </div>
        );

      case 'pending':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-yellow-600 dark:text-yellow-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
              قيد المعالجة
            </h2>
            <p className="text-muted-foreground mb-4">
              جاري معالجة عملية الدفع
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              سيتم تحديث رصيدك تلقائياً عند اكتمال العملية
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-lg">نتيجة الدفع</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {renderContent()}
          
          <div className="flex gap-3 mt-6">
            <Button 
              className="flex-1" 
              onClick={() => navigate('/rider')}
            >
              <Home className="w-4 h-4 ml-2" />
              الرئيسية
            </Button>
            {status === 'failed' && (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate('/rider/payments')}
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                المحاولة مجدداً
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentResult;
