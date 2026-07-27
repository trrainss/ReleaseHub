import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
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
      addToast('Verification email sent. Check your inbox.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : typeof err === 'object' && err !== null ? JSON.stringify(err)
        : String(err);
      console.error('SignUp error:', err);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-form">
        <h1 className="auth-form__title">Check your email</h1>
        <p>We sent a verification link. After confirming, you can sign in.</p>
        <Link to="/auth/signin" className="btn btn--primary">Go to Sign In</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
      <h1 className="auth-form__title">Sign Up</h1>
      <Input
        label="Display Name"
        {...register('displayName')}
        error={errors.displayName?.message}
      />
      <Input
        label="Email"
        type="email"
        {...register('email')}
        error={errors.email?.message}
      />
      <Input
        label="Password"
        type="password"
        {...register('password')}
        error={errors.password?.message}
      />
      <Button type="submit" loading={loading} className="auth-form__submit">
        Sign Up
      </Button>
      <p className="auth-form__links">
        <Link to="/auth/signin">Already have an account?</Link>
      </p>
    </form>
  );
}
