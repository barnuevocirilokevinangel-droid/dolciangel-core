import React, { useState, useEffect } from 'react';
import { useApp, SEDES, PERFILES } from '../context/AppContext';
import { Store, User, Lock, Delete, ArrowLeft, Check, Sparkles, ShieldCheck } from 'lucide-react';

export const LoginModal = ({ isOpen, onClose, canClose = false }) => {
  const { sede: currentSede, perfil: currentPerfil, login } = useApp();

  const [step, setStep] = useState(1); // 1: Elegir local, 2: Elegir perfil, 3: Ingresar PIN
  const [selectedSede, setSelectedSede] = useState('BA');
  const [selectedPerfil, setSelectedPerfil] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (currentSede && currentPerfil) {
        setSelectedSede(currentSede);
        setSelectedPerfil(currentPerfil);
        setStep(2);
      } else {
        setStep(1);
        setSelectedPerfil(null);
        setPin('');
      }
      setError('');
    }
  }, [isOpen, currentSede, currentPerfil]);

  if (!isOpen) return null;

  const handleSelectSede = (sedeKey) => {
    setSelectedSede(sedeKey);
    setStep(2);
    setError('');
  };

  const handleSelectPerfil = (perfilObj) => {
    setSelectedPerfil(perfilObj);
    setPin('');
    setError('');
    setStep(3);
  };

  const handlePinInput = (digit) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleDeletePin = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };

  const handleClearPin = () => {
    setPin('');
    setError('');
  };

  const verifyPin = (pinToTest) => {
    const success = login(selectedSede, selectedPerfil, pinToTest);
    if (success) {
      onClose();
    } else {
      setError('PIN incorrecto. Intenta nuevamente.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-pink-100 w-full max-w-md overflow-hidden relative transition-all">
        {/* Cabecera superior decorativa */}
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-pink-500 p-6 text-white text-center relative">
          {canClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              ✕
            </button>
          )}

          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-inner mb-3">
            🧁
          </div>
          <h2 className="text-2xl font-serif font-bold tracking-tight">Bienvenida a Dolciangel</h2>
          <p className="text-pink-100 text-xs mt-1">
            Sistema Integrado de Gestión POS & Control de Inventario
          </p>
        </div>

        {/* Contenido según paso */}
        <div className="p-6">
          {/* PASO 1: Elegir local */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-5">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
                  Paso 1 de 2
                </span>
                <h3 className="text-lg font-bold text-slate-800 mt-2">¿En qué local estás hoy?</h3>
                <p className="text-xs text-slate-500">Selecciona la sede para cargar el inventario correspondiente</p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {Object.values(SEDES).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSede(s.id)}
                    className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-brand-500 bg-slate-50/70 hover:bg-pink-50/50 transition-all text-left group shadow-sm hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {s.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 group-hover:text-brand-700 text-base">
                          {s.nombre}
                        </h4>
                        <span className="text-[11px] font-semibold text-brand-600 bg-brand-100/70 px-2 py-0.5 rounded-full">
                          Sede Activa
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{s.ciudad}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 2: Elegir perfil */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700 font-semibold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Cambiar local
                </button>
                <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                  {SEDES[selectedSede].nombre}
                </span>
              </div>

              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-slate-800">¿Quién ingresa al turno?</h3>
                <p className="text-xs text-slate-500">Selecciona tu perfil para ingresar con tu PIN</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {PERFILES.filter(p => p.sede === 'ALL' || p.sede === selectedSede).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPerfil(p)}
                    className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-slate-100 hover:border-brand-500 bg-slate-50/70 hover:bg-pink-50/50 transition-all text-left group shadow-sm hover:shadow active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                        {p.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 group-hover:text-brand-700 text-sm">
                            {p.nombre}
                          </h4>
                          {p.isDueno && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-amber-300">
                              Dueño
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{p.rol}</p>
                      </div>
                    </div>
                    <span className="text-slate-300 group-hover:text-brand-600 font-bold text-lg">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 3: Ingreso de PIN de 4 dígitos */}
          {step === 3 && selectedPerfil && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700 font-semibold transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Cambiar perfil
                </button>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>{selectedPerfil.avatar}</span>
                  <span className="font-bold text-slate-800">{selectedPerfil.nombre}</span>
                </div>
              </div>

              <div className="text-center mb-3">
                <div className="w-10 h-10 rounded-full bg-pink-100 text-brand-700 mx-auto flex items-center justify-center mb-2">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Ingresa tu PIN de 4 dígitos</h3>
                <p className="text-xs text-slate-500">
                  {selectedPerfil.isDueno ? 'PIN de administrador (def: 0000)' : 'PIN de colaborador'}
                </p>
              </div>

              {/* Indicador de 4 dígitos */}
              <div className="flex justify-center gap-3 my-3">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-200 ${
                        filled
                          ? 'bg-brand-700 scale-125 shadow-md shadow-brand-500/30'
                          : 'bg-slate-200 border border-slate-300'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Mensaje de error */}
              {error && (
                <div className="text-center text-xs font-semibold text-rose-600 bg-rose-50 py-1.5 px-3 rounded-xl border border-rose-200 animate-shake">
                  {error}
                </div>
              )}

              {/* Teclado numérico táctil */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePinInput(num.toString())}
                    className="h-12 rounded-2xl bg-slate-100 hover:bg-pink-100/70 text-slate-800 font-bold text-lg shadow-sm border border-slate-200/80 active:scale-95 transition-all flex items-center justify-center hover:text-brand-800"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleClearPin}
                  className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs shadow-sm border border-slate-200/80 active:scale-95 transition-all flex items-center justify-center"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => handlePinInput('0')}
                  className="h-12 rounded-2xl bg-slate-100 hover:bg-pink-100/70 text-slate-800 font-bold text-lg shadow-sm border border-slate-200/80 active:scale-95 transition-all flex items-center justify-center hover:text-brand-800"
                >
                  0
                </button>
                <button
                  onClick={handleDeletePin}
                  className="h-12 rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 shadow-sm border border-slate-200/80 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center pt-2 text-[11px] text-slate-400">
                {selectedPerfil?.isDueno 
                  ? 'PIN de Administrador (0000)' 
                  : 'Ingresa tu PIN asignado de 4 dígitos'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
