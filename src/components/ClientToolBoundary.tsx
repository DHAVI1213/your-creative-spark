import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { useSiteSettings } from '../lib/site-settings';
import { Empty } from './ui';
import { LockKeyhole, LoaderCircle } from 'lucide-react';
export default function ClientToolBoundary({children}:{children:React.ReactNode}) {
 const {toolId}=useParams();const settings=useSiteSettings(); const [active,setActive]=useState<boolean|null>(null);
 useEffect(()=>{let alive=true; const check=async()=>{const {data:{session}}=await supabase.auth.getSession(); if(!session){if(alive)setActive(true);return;}const {data,error}=await supabase.rpc('client_account_state');if(alive)setActive(!error && (data as {active:boolean}|null)?.active!==false);};void check();const id=setInterval(()=>void check(),30000);return()=>{alive=false;clearInterval(id);};},[]);
 const tool=settings.tools.find(t=>t.id===toolId);
 useEffect(()=>{if(active!==true||!settings.loaded||settings.error||!tool?.enabled)return;const record=async(initial:boolean)=>{const {data:{session}}=await supabase.auth.getSession();if(session)await supabase.rpc('record_activity',initial?{_tool_id:toolId}:{});};void record(true);const id=setInterval(()=>void record(false),45000);return()=>clearInterval(id);},[active,settings.loaded,settings.error,tool?.enabled,toolId]);
 if(!settings.loaded||active===null)return <div className="flex justify-center p-16"><LoaderCircle className="animate-spin text-lime" /></div>;
 if(settings.error||!active||!tool?.enabled)return <Empty icon={<LockKeyhole/>} titulo={!active?'Conta desativada':'Ferramenta indisponível'} descricao={settings.error?'Não foi possível verificar a disponibilidade. Tente novamente.':'Esta ferramenta não está disponível para sua conta no momento.'}/>;
 return <>{children}</>;
}