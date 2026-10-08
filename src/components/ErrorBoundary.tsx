import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetLocalData = () => {
    if (window.confirm('Очистити локальний кеш та перезавантажити з вихідними даними?')) {
      localStorage.removeItem('hr_analytics_local_data');
      localStorage.removeItem('hr_local_auth');
      localStorage.removeItem('oauth_access_token');
      localStorage.removeItem('google_user_profile');
      window.location.reload();
    }
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-850 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-fade-in">
            <div className="h-16 w-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30 shadow-inner">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Виникла тимчасова помилка інтерфейсу
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Додаток перехопив збій відображення. Ваші дані збережені. Ви можете перезавантажити сторінку або відновити стан за замовчуванням.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-left overflow-auto max-h-36">
                <p className="text-[11px] font-mono text-rose-300 select-all font-bold">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shadow-md"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Перезавантажити сторінку</span>
              </button>

              <button
                onClick={this.handleResetLocalData}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2 border border-slate-700 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-rose-400" />
                <span>Скинути кеш</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
