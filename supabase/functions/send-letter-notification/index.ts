import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const EMAILJS_SERVICE_ID="service_p5fkbd7", EMAILJS_TEMPLATE_ID="template_q4ucc9c", EMAILJS_PUBLIC_KEY="w8yX3Ti7xYPworE4h";
const SHOP_ORIGIN="https://fionyannawang-pixel.github.io";
const SHOP_URL=SHOP_ORIGIN+"/the-little-shop/";
function hex(bytes:Uint8Array){return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function signLetter(letterId:string,key:string){const cryptoKey=await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return hex(new Uint8Array(await crypto.subtle.sign("HMAC",cryptoKey,new TextEncoder().encode("little-shop-letter:"+letterId))))}
Deno.serve(async(request:Request)=>{
  if(request.method!=="POST") return new Response(JSON.stringify({error:"Method not allowed."}),{status:405,headers:{"Content-Type":"application/json"}});
  try{
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!key) return new Response(JSON.stringify({error:"Notification worker is not configured."}),{status:503,headers:{"Content-Type":"application/json"}});
    const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:letters,error:claimError}=await supabase.rpc("claim_due_letter_notifications",{p_limit:50});
    if(claimError) throw new Error("Could not claim due letters.");
    let sent=0,failed=0;
    for(const letter of letters??[]){
      let status:"sent"|"failed"="failed",errorMessage="EmailJS request failed.";
      try{
        const guestToken=await signLetter(letter.id,key);
        const letterUrl=SHOP_URL+"?letter="+encodeURIComponent(letter.id)+"&guest="+encodeURIComponent(guestToken)+"#shop";
        const response=await fetch("https://api.emailjs.com/api/v1.0/email/send",{method:"POST",headers:{"Content-Type":"application/json","Origin":SHOP_ORIGIN},body:JSON.stringify({service_id:EMAILJS_SERVICE_ID,template_id:EMAILJS_TEMPLATE_ID,user_id:EMAILJS_PUBLIC_KEY,template_params:{to_email:letter.recipient_email,name:"Beyond Small Beyond Big Store Official",from_name:"Beyond Small Beyond Big Store Official",email:letter.recipient_email,letter_url:letterUrl}})});
        const responseText=(await response.text()).trim();
        if(!response.ok){
          const safeDetail=responseText.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"[address]").slice(0,180);
          errorMessage="EmailJS rejected the notification (HTTP "+response.status+")"+(safeDetail?": "+safeDetail:"");
          throw new Error("EmailJS rejected the notification.");
        }
        status="sent";
      }catch{}
      const {error:updateError}=await supabase.from("letters").update({email_status:status,sent_at:status==="sent"?new Date().toISOString():null,email_error:status==="failed"?errorMessage:null}).eq("id",letter.id).eq("email_status","sending");
      if(updateError) failed++; else if(status==="sent") sent++; else failed++;
    }
    return new Response(JSON.stringify({ok:true,processed:sent+failed,sent,failed}),{status:200,headers:{"Content-Type":"application/json"}});
  }catch{
    return new Response(JSON.stringify({error:"Notification run failed."}),{status:500,headers:{"Content-Type":"application/json"}});
  }
});