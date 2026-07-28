import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '@/shared/api/auth';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export function SignInForm() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      addToast('Добро пожаловать!', 'success');
      navigate('/workspaces');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка входа', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
      <h1 className="auth-form__title">🚀 ReleaseHub</h1>
      <p style={{ 
        textAlign: 'center', 
        color: 'var(--color-text-secondary)', 
        marginBottom: '1.5rem',
        fontSize: '0.875rem'
      }}>
        Управление релизами
      </p>

      <Input
        label="Email"
        type="email"
        placeholder="Введите email"
        autoComplete="email"
        {...register('email')}
        error={errors.email?.message}
      />

      <Input
        label="Пароль"
        type="password"
        placeholder="Введите пароль"
        autoComplete="current-password"
        {...register('password')}
        error={errors.password?.message}
      />

      <Button type="submit" loading={loading} className="auth-form__submit">
        Войти
      </Button>

      <div className="auth-form__links" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.5rem',
        marginTop: '1rem',
        alignItems: 'center'
      }}>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => navigate('/auth/signup')}
          style={{ color: 'var(--color-primary)' }}
        >
          Нет аккаунта? Зарегистрироваться
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => navigate('/auth/reset-password')}
        >
          Забыли пароль?
        </button>
      </div>
    </form>
  );
}