import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUp } from '@/shared/api/auth';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
});

type FormData = z.infer<typeof schema>;

export function SignUpForm() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await signUp(data.email, data.password, data.displayName);
      setSent(true);
      addToast('Подтвердите email! Проверьте почту.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка регистрации', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-form">
        <h1 className="auth-form__title">Проверьте почту</h1>
        <p className="auth-form__subtitle">
          Мы отправили ссылку для подтверждения. После подтверждения вы сможете войти.
        </p>
        <button
          type="button"
          className="btn btn--primary auth-form__submit"
          onClick={() => navigate('/auth/signin')}
        >
          Перейти ко входу
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
      <h1 className="auth-form__title">Создать аккаунт</h1>
      <p className="auth-form__subtitle">
        Начните управлять релизами
      </p>

      <Input
        label="Имя"
        type="text"
        placeholder="Введите ваше имя"
        autoComplete="name"
        {...register('displayName')}
        error={errors.displayName?.message}
      />

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
        autoComplete="new-password"
        {...register('password')}
        error={errors.password?.message}
      />

      <Button type="submit" loading={loading} className="auth-form__submit">
        Зарегистрироваться
      </Button>

      <div className="auth-form__links">
        <button
          type="button"
          className="auth-form__link"
          onClick={() => navigate('/auth/signin')}
        >
          Уже есть аккаунт? Войти
        </button>
      </div>
    </form>
  );
}