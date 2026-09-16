import { useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Action, Input, ui } from './route-controls';
export function AuthForm({ register, navigate, signedIn }: { register: boolean; navigate: (screen: 'home' | 'login' | 'register') => void; signedIn: boolean }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [confirm, setConfirm] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    if (!email.includes('@') || password.length < 8 || (register && (!name.trim() || confirm !== password))) {
      setMessage('Revisa correo, nombre y contrasena (minimo 8 caracteres). Las contrasenas deben coincidir.'); return;
    }
    setBusy(true); setMessage('');
    try {
      const result = register ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } }) : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (result.data.session) navigate('home'); else setMessage('Confirma tu correo y luego inicia sesion.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo conectar.'); }
    finally { setBusy(false); }
  }
  return <View style={ui.content}>
    <Text style={ui.title}>Rutas de Trekking</Text><Text style={ui.label}>{register ? 'Crear cuenta' : 'Iniciar sesion'}</Text>
    {signedIn ? <><Text>Ya tienes una sesion activa.</Text><Action label="Continuar" onPress={() => navigate('home')} /><Action label="Cerrar sesion" onPress={() => void supabase.auth.signOut({ scope: 'local' }).catch(() => setMessage('No se pudo cerrar la sesion.'))} /></> : <>
    {register && <Input label="Nombre completo" value={name} onChangeText={setName} />}
    <Input label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
    <Input label="Contrasena" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={register ? 'new-password' : 'current-password'} />
    {register && <Input label="Confirmar contrasena" value={confirm} onChangeText={setConfirm} secureTextEntry />}
    <Action label={busy ? 'Conectando...' : register ? 'Registrarme' : 'Ingresar'} onPress={() => void submit()} disabled={busy} />
    <Action label={register ? 'Ya tengo cuenta' : 'Crear cuenta'} onPress={() => navigate(register ? 'login' : 'register')} />
    <Action label="Continuar sin cuenta" onPress={() => navigate('home')} />
    </>}
    {!!message && <Text accessibilityRole="alert" style={ui.error}>{message}</Text>}
  </View>;
}
