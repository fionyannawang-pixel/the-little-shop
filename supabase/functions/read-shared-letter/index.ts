import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const SHOP_ORIGIN="https://fionyannawang-pixel.github.io";
const cors={"Access-Control-Allow-Origin":SHOP_ORIGIN,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"apikey, authorization, content-type, x-client-info","Vary":"Origin"};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}
function hex(bytes:Uint8Array){return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function signLetter(letterId:string,key:string){const cryptoKey=await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(new Uint8Array(await crypto.subtle.sign("HMAC",cryptoKey,new TextEncoder().encode("little-shop-letter:"+letterId))))}
function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
Deno.serve(async(request:Request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="GET")return json({error:"Method not allowed."},405);
  try{
    const url=new URL(request.url),letterId=url.searchParams.get("letter_id")||"",token=url.searchParams.get("token")||"";
    if(!/^[0-9a-f-]{36}$/i.test(letterId)||!/^[0-9a-f]{64}$/i.test(token))return json({error:"This letter link is invalid or has expired."},404);
    const projectUrl=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!projectUrl||!key)return json({error:"Letter service is temporarily unavailable."},503);
    const expected=await signLetter(letterId,key);
    if(!equal(expected,token.toLowerCase()))return json({error:"This letter link is invalid or has expired."},404);
    const supabase=createClient(projectUrl,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:letter,error}=await supabase.from("letters").select("id,sender_name,recipient_kind,recipient_email,delivery_date,body").eq("id",letterId).maybeSingle();
    if(error||!letter||letter.recipient_kind!=="other"||!letter.recipient_email)return json({error:"This letter is not available from this link."},404);
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto"}).format(new Date());
    if(letter.delivery_date&&letter.delivery_date>today)return json({error:"This letter is not ready yet."},404);
    return json({letter:{id:letter.id,sender_name:letter.sender_name,delivery_date:letter.delivery_date,body:letter.body}});
  }catch{return json({error:"Could not open this letter right now."},500)}
});