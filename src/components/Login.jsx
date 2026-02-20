import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

// Logo for light background (login card)
import logoLight from '../../Assests and Branding/Logos/Forma-Logo-Metal-Tagline.png';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const success = await login(username, password);
        if (!success) {
            setError('Invalid username or password. Please try again.');
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <h1 className="login-brand">FORMA STEEL</h1>
                <p className="login-tagline">Creative Solutions in Steel</p>
                <img
                    src={logoLight}
                    alt="Forma Steel"
                    className="login-logo"
                />
                <h2 className="login-title">Pricing Strategy</h2>
                <p className="login-subtitle">Sign in to access your account</p>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            autoFocus
                            autoComplete="username"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                        />
                    </div>
                    <button type="submit" className="login-submit">
                        Sign In
                    </button>
                </form>

                <p className="login-footer">
                    Forma Steel · Creative Solutions in Steel
                </p>
            </div>
        </div>
    );
};

export default Login;
