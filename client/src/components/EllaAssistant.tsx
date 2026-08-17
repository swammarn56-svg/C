import { Mic, MicOff, Send, Volume2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type EllaAssistantProps = { date: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "my-MM";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export default function EllaAssistant({ date }: EllaAssistantProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const ask = trpc.assistant.ask.useMutation({
    onSuccess: result => {
      setAnswer(result.answer);
      speak(result.answer);
    },
    onError: error => setAnswer(error.message || "Ella က အခုအချိန်မှာ မဖြေနိုင်သေးပါ။"),
  });

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    setAnswer("");
    ask.mutate({ question: trimmed, date });
  };

  const startListening = () => {
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage("ဒီ Browser မှာ Voice input မရပါ။ စာနဲ့မေးနိုင်ပါတယ်။");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "my-MM";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").trim();
      const cleaned = transcript.replace(/^အဲလာ[၊,။\s]*/i, "").replace(/^ella[၊,။\s]*/i, "").trim();
      setQuestion(cleaned || transcript);
      setVoiceMessage(cleaned ? "အဲလာက မေးခွန်းကို ရရှိပါပြီ။" : "အဲလာလို့ခေါ်ပြီး မေးခွန်းကို ပြောပေးပါ။");
      setIsListening(false);
      if (cleaned) ask.mutate({ question: cleaned, date });
    };
    recognition.onerror = () => { setIsListening(false); setVoiceMessage("အသံကို မကြားရပါ။ ထပ်စမ်းပါ သို့မဟုတ် စာနဲ့မေးပါ။"); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setVoiceMessage("အဲလာလို့ခေါ်ပြီး မြန်မာလို မေးပါ…");
    setIsListening(true);
    recognition.start();
  };

  return <>
    <button className="ella-trigger" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Open Ella read-only assistant">အဲလာ</button>
    {open && <aside className="ella-panel" aria-label="Ella read-only assistant">
      <header className="ella-panel-header"><div><strong>အဲလာ</strong><small>Read-only ERP Assistant · {date}</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close Ella"><X size={16} /></button></header>
      <div className="ella-panel-body"><p className="ella-intro">Closing, Used, Purchase, Damage နဲ့ Sales စာရင်းတွေကို မေးနိုင်ပါတယ်။ အဲလာက စာရင်းကို မပြင်နိုင်ပါ။</p>{answer && <div className="ella-answer"><strong>အဖြေ</strong><p>{answer}</p><button type="button" onClick={() => speak(answer)} aria-label="Read answer aloud"><Volume2 size={15} /> အသံနဲ့ဖတ်ရန်</button></div>}{voiceMessage && <p className="ella-voice-status">{voiceMessage}</p>}</div>
      <form className="ella-form" onSubmit={submit}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="ဥပမာ - ဂျုံ Closing ဘယ်လောက်လဲ?" aria-label="Ask Ella" /><button type="button" onClick={isListening ? () => recognitionRef.current?.stop() : startListening} aria-label={isListening ? "Stop listening" : "Ask by voice"}>{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button><button type="submit" disabled={!question.trim() || ask.isPending} aria-label="Send question"><Send size={16} /></button></form>
    </aside>}
  </>;
}
