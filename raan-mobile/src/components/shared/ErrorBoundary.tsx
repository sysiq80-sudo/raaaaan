/**
 * ران - Error Boundary Component
 * يلتقط الأخطاء غير المتوقعة ويعرض شاشة بديلة
 */

import React, { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>حدث خطأ غير متوقع</Text>
          <Text style={styles.message}>
            نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetail}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 24,
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  errorDetail: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    width: '100%',
  },
  retryBtn: {
    backgroundColor: '#00d9a5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  retryText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
