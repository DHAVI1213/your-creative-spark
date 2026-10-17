import type {Meta,Settings} from './model';
export function buildArgs(job:{meta:Meta;s:Settings;input:string},paths:{bg:string;ov:string;out:string;capa:string|null}):{args:string[];outDur:number};
