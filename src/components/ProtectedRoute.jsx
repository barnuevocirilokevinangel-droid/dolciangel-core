import React from 'react';
import { useApp } from '../context/AppContext';
import { LoginModal } from './LoginModal';

/**
 * Guardián de ruta estricto para Dolciangel Core (/core o /admin)
 * Bloquea el renderizado de cualquier vista interna (Ventas, Inventario, Caja, etc.)
 * hasta que el colaborador seleccione su perfil e ingrese su PIN de seguridad.
 */
export const ProtectedRoute = ({ children, onNavigate }) => {
  const { sede, perfil } = useApp();

  // Si no está autenticado con perfil y PIN válido, mostrar únicamente la pantalla de bloqueo
  if (!sede || !perfil) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 selection:bg-brand-500 selection:text-white">
        <LoginModal 
          isOpen={true} 
          onClose={() => {}}
          canClose={false}
        />
        <div className="fixed bottom-6 z-50 text-center">
          <button
            onClick={() => onNavigate && onNavigate('landing')}
            className="text-xs text-slate-400 hover:text-white underline font-semibold transition-colors"
          >
            ← Volver a la página web pública
          </button>
        </div>
      </div>
    );
  }

  // Acceso autorizado
  return children;
};
