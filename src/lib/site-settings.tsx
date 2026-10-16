import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import type { Plan, SiteContent, ToolSetting } from './admin-metrics';
type Settings = { plans: Plan[]; content: SiteContent; tools: ToolSetting[]; loaded: boolean; error: string };
const Context = createContext<Settings>({plans:[],content:{},tools:[],loaded:false,error:''});
export function SiteSettingsProvider({children}:{children:React.ReactNode}) {
 const [settings,setSettings]=useState<Settings>({plans:[],content:{},tools:[],loaded:false,error:''});
 useEffect(()=>{let alive=true;const load=async()=>{const {data,error}=await supabase.rpc('public_site_settings');if(alive)setSettings(error?{plans:[],content:{},tools:[],loaded:true,error:error.message}:{...(data as unknown as Omit<Settings,'loaded'|'error'>),loaded:true,error:''});};void load();const id=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(id);};},[]);
 return <Context.Provider value={settings}>{children}</Context.Provider>;
}
export const useSiteSettings=()=>useContext(Context);