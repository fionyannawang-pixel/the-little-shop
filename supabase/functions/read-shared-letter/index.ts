import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const SHOP_ORIGIN="https://fionyannawang-pixel.github.io";
const cors={"Access-Control-Allow-Origin":SHOP_ORIGIN,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"apikey, authorization, content-type, x-client-info","Vary":"Origin"};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}})}
Deno.serve(async(request:Request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(request.method!=="GET")return json({error:"Method not allowed."},405);
  try{
    const letterId=new URL(request.url).searchParams.get("letter_id")||"";
    if(!/^[0-9a-f-]{36}$/i.test(letterId))return json({error:"Letter not found."},404);
    const projectUrl=Deno.env.get("SUPABASE_URL");
    const publishable=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||Deno.env.get("SUPABASE_ANON_KEY");
    const authorization=request.headers.get("Authorization");
    if(!projectUrl||!publishable||!authorization)return json({error:"Please sign in to read this letter."},401);
    const supabase=createClient(projectUrl,publishable,{global:{headers:{Authorization:authorization}},auth:{autoRefreshToken:false,persistSession:false}});
    const {data:letter,error}=await supabase.from("letters").select("id,sender_name,recipient_kind,delivery_date,body").eq("id",letterId).maybeSingle();
    if(error||!letter||letter.recipient_kind!=="other")return json({error:"Letter not found."},404);
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto"}).format(new Date());
    if(letter.delivery_date&&letter.delivery_date>today)return json({error:"This letter is not ready yet."},404);
    return json({letter:{id:letter.id,sender_name:letter.sender_name,delivery_date:letter.delivery_date,body:letter.body}});
  }catch{return json({error:"Could not open this letter right now."},500)}
});