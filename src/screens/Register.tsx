import React, { useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/language';

export const Register: React.FC = () => {
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [username, setUsername] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const { t } = useLanguage();

    const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
            email, password, options: { data: { username } },
        });
        setLoading(false);
        if (error) alert(`${t('Registration failed')}: ${error.message}`);
        else {
            alert(t('Account created. Check your email if confirmation is enabled.'));
            console.log('Registered user:', data);
        }
    };

    return (
        <section className="w-full max-w-sm border border-ui bg-page p-6 sm:p-7">
            <p className="type-overline mb-2">{t('Start planning')}</p>
            <h2 className="font-display text-2xl font-bold tracking-tightest text-charcoal">{t('Create your account')}</h2>
            <p className="mt-2 font-body text-[12px] leading-relaxed text-slate">
                {t('Set up your study space and bring your week into focus.')}
            </p>
            <form onSubmit={handleRegister} className="mt-7 flex flex-col gap-5">
                <div>
                    <label htmlFor="register-name" className="type-label block text-charcoal">{t('Username')}</label>
                    <input id="register-name" type="text" autoComplete="username" value={username}
                        onChange={(e) => setUsername(e.target.value)} required placeholder={t('Choose a username')}
                        className="mt-2 w-full rounded-sm border border-ui bg-page px-3 py-3 font-body text-[13px] text-ink outline-none transition-colors placeholder:text-muted-3 focus:border-charcoal" />
                </div>
                <div>
                    <label htmlFor="register-email" className="type-label block text-charcoal">{t('Email address')}</label>
                    <input id="register-email" type="email" autoComplete="email" value={email}
                        onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com"
                        className="mt-2 w-full rounded-sm border border-ui bg-page px-3 py-3 font-body text-[13px] text-ink outline-none transition-colors placeholder:text-muted-3 focus:border-charcoal" />
                </div>
                <div>
                    <label htmlFor="register-password" className="type-label block text-charcoal">{t('Password')}</label>
                    <input id="register-password" type="password" autoComplete="new-password" value={password}
                        onChange={(e) => setPassword(e.target.value)} required placeholder={t('Create a password')}
                        className="mt-2 w-full rounded-sm border border-ui bg-page px-3 py-3 font-body text-[13px] text-ink outline-none transition-colors placeholder:text-muted-3 focus:border-charcoal" />
                </div>
                <button type="submit" disabled={loading}
                    className="mt-1 w-full rounded-sm bg-primary px-4 py-3 font-display text-[10px] font-bold tracking-widest text-primary-contrast transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50">
                    {loading ? t('CREATING ACCOUNT…') : t('CREATE ACCOUNT')}
                </button>
            </form>
        </section>
    );
};
