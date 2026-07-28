import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { ToastProvider } from '@/shared/ui/Toast';
import { queryClient } from '@/app/queryClient';
import { router } from '@/app/router';

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={ruRU}
        theme={{
          token: {
            colorPrimary: '#6366f1',
            colorBgContainer: '#1a1d27',
            colorText: '#e4e6ef',
            colorTextSecondary: '#8b8fa3',
            colorBorder: '#2a2d3a',
            borderRadius: 8,
          },
          components: {
            Button: {
              controlHeight: 44,
              borderRadius: 8,
              fontWeight: 600,
            },
            Card: {
              borderRadius: 12,
            },
            Input: {
              controlHeight: 44,
              borderRadius: 8,
            },
            Modal: {
              borderRadius: 12,
            },
          },
        }}
      >
        <AuthProvider>
          <ToastProvider>
            <AntApp>
              <RouterProvider router={router} />
            </AntApp>
          </ToastProvider>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}