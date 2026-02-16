import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    handleReset = () => {
        if (confirm('This will clear all saved data (Products, Customers, Sales). Are you sure?')) {
            localStorage.clear();
            window.location.reload();
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '40px',
                    fontFamily: 'system-ui, sans-serif',
                    maxWidth: '600px',
                    margin: '0 auto',
                    textAlign: 'center'
                }}>
                    <h1 style={{ color: '#ef4444' }}>Something went wrong.</h1>
                    <p style={{ color: '#4b5563', marginBottom: '20px' }}>
                        The application encountered a critical error and cannot load.
                        This is likely due to corrupted data or a failed import.
                    </p>
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '2rem',
                        textAlign: 'left',
                        overflow: 'auto',
                        maxHeight: '200px'
                    }}>
                        <code>{this.state.error?.toString()}</code>
                    </div>
                    <button
                        onClick={this.handleReset}
                        style={{
                            backgroundColor: '#dc2626',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '6px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Reset Application Data
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
