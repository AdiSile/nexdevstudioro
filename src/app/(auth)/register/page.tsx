'use client';

import { useState } from 'react';
import { Heading } from '@shared/ui/heading';
import { Text } from '@shared/ui/text-styles';
import { inputBase, inputEnabled, inputDisabled, inputError } from '@shared/ui/input-styles';

type FormData = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormData, string>> & { general?: string };

const initialFormData: FormData = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

function validate(form: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Name is required';
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Invalid email format';
  }

  if (!form.password) {
    errors.password = 'Password is required';
  } else if (form.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return errors;
}

export default function RegisterPage() {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess(false);

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      // Placeholder API call – replace with actual registration endpoint
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess(true);
      setForm(initialFormData);
    } catch (err) {
      setErrors({ general: 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: keyof FormData) =>
    `${inputBase} ${inputEnabled} ${errors[field] ? inputError : ''}`;

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-lg bg-white p-8 shadow">
      <Heading tag="h2">Create your account</Heading>

      {success && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-green-800">
          Registration successful! Please check your email to verify your account.
        </div>
      )}

      {errors.general && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <Text tag="label" className="mb-1 block">
            Name
          </Text>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            className={inputClass('name')}
            disabled={loading}
            placeholder="Your full name"
          />
          {errors.name && (
            <Text tag="span" muted className="mt-1 text-red-600">
              {errors.name}
            </Text>
          )}
        </div>

        <div>
          <Text tag="label" className="mb-1 block">
            Email
          </Text>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className={inputClass('email')}
            disabled={loading}
            placeholder="you@example.com"
          />
          {errors.email && (
            <Text tag="span" muted className="mt-1 text-red-600">
              {errors.email}
            </Text>
          )}
        </div>

        <div>
          <Text tag="label" className="mb-1 block">
            Password
          </Text>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className={inputClass('password')}
            disabled={loading}
            placeholder="••••••••"
          />
          {errors.password && (
            <Text tag="span" muted className="mt-1 text-red-600">
              {errors.password}
            </Text>
          )}
        </div>

        <div>
          <Text tag="label" className="mb-1 block">
            Confirm password
          </Text>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            className={inputClass('confirmPassword')}
            disabled={loading}
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <Text tag="span" muted className="mt-1 text-red-600">
              {errors.confirmPassword}
            </Text>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <Text muted className="text-center">
        Already have an account?{' '}
        <a href="/login" className="text-blue-600 underline">
          Sign in
        </a>
      </Text>
    </div>
  );
}