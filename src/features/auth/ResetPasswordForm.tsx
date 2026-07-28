import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '@/shared/api/auth';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

const schema = z.object({
  email: z.string().email('Invalid email'),
});

type FormData = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await resetPassword(data.email);
      setSent(true);
      addToast('Reset link sent to your email', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to send reset email', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-form">
        <h1 className="auth-form__title">Проверьте почту</h1>
        <p className="auth-form__subtitle">
          Ссылка для сброса пароля отправлена на ваш email.
        </p>
        <Link to="/auth/signin" className="btn btn--primary auth-form__submit">Вернуться ко входу</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
      <h1 className="auth-form__title">Сброс пароля</h1>
      <p className="auth-form__subtitle">
        Введите email — мы отправим ссылку для восстановления
      </p>
      <Input
        label="Email"
        type="email"
        {...register('email')}
        error={errors.email?.message}
      />
      <Button type="submit" loading={loading} className="auth-form__submit">
        Отправить ссылку
      </Button>
      <div className="auth-form__links">
        <Link to="/auth/signin" className="auth-form__link">Вернуться ко входу</Link>
      </div>
    </form>
  );
}
