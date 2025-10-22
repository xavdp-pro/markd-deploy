import React, { useState } from 'react';
import Header from '../components/layout/Header';
import { Mail, Send, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const EmailTestPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [testEmail, setTestEmail] = useState('');
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          type: 'success',
          message: `Email de test envoyé avec succès à ${testEmail} !`
        });
      } else {
        setResult({
          type: 'error',
          message: data.detail || 'Échec de l\'envoi de l\'email'
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: 'Erreur de connexion au serveur'
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Test d'envoi d'emails</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Testez la configuration SMTP Mailjet et les templates MJML</p>
          </div>

          {result && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              result.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              {result.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={result.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {result.message}
                </p>
              </div>
            </div>
          )}

          {/* Configuration Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">📧 Configuration Mailjet</h3>
            <div className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <p>• <strong>Host:</strong> in-v3.mailjet.com</p>
              <p>• <strong>Port:</strong> 587 (TLS)</p>
              <p>• <strong>From:</strong> xavier@ooo.ovh</p>
              <p>• <strong>Template:</strong> MJML (compilé en HTML)</p>
            </div>
          </div>

          {/* Test Email */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-800 dark:text-white" />
              Email de test
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Envoie un email de test pour vérifier la configuration SMTP Mailjet
            </p>
            <form onSubmit={handleTestEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="votre@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isLoading ? 'Envoi...' : 'Envoyer email de test'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailTestPage;
