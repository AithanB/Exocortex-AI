import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/language';

export function Login() {
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const { t } = useLanguage();

    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) alert(`${t('Sign-in failed')}: ${error.message}`);
        else console.log('Signed in:', data);
    };

    return (
        <section className="w-full max-w-sm border border-ui bg-page p-6 sm:p-7">
            <p className="type-overline mb-2">{t('Welcome back')}</p>
            <h2 className="font-display text-2xl font-bold tracking-tightest text-charcoal">{t('Sign in')}</h2>
            <p className="mt-2 font-body text-[12px] leading-relaxed text-slate">
                {t('Pick up where you left off and keep your study plan moving.')}
            </p>
            <form onSubmit={handleLogin} className="mt-7 flex flex-col gap-5">
                <div>
                    <label htmlFor="login-email" className="type-label block text-charcoal">{t('Email address')}</label>
                    <input id="login-email" type="email" autoComplete="email" value={email}
                        onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                        className="mt-2 w-full rounded-sm border border-ui bg-page px-3 py-3 font-body text-[13px] text-ink outline-none transition-colors placeholder:text-muted-3 focus:border-charcoal" />
                </div>
                <div>
                    <label htmlFor="login-password" className="type-label block text-charcoal">{t('Password')}</label>
                    <input id="login-password" type="password" autoComplete="current-password" value={password}
                        onChange={(e) => setPassword(e.target.value)} required placeholder={t('Enter your password')}
                        className="mt-2 w-full rounded-sm border border-ui bg-page px-3 py-3 font-body text-[13px] text-ink outline-none transition-colors placeholder:text-muted-3 focus:border-charcoal" />
                </div>
                <button type="submit" disabled={loading}
                    className="mt-1 w-full rounded-sm bg-primary px-4 py-3 font-display text-[10px] font-bold tracking-widest text-primary-contrast transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50">
                    {loading ? t('SIGNING IN…') : t('SIGN IN')}
                </button>
            </form>
        </section>
    );
}
