import { Mic, MicOff, Send, Volume2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { extractEllaWakeQuestion } from "../../../shared/ella";

type EllaAssistantProps = { date: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
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
  const stageRef = useRef<"wake" | "question" | null>(null);
  const ask = trpc.assistant.ask.useMutation({
    onSuccess: result => { setAnswer(result.answer); speak(result.answer); },
    onError: error => setAnswer(error.message || "အဲလာက အခုအချိန်မှာ မဖြေနိုင်သေးပါ။"),
  });

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    setAnswer("");
    ask.mutate({ question: trimmed, date });
  };

  const listenForQuestion = () => {
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage("ဒီ Browser မှာ Voice input မရပါ။ စာနဲ့မေးနိုင်ပါတယ်။");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "my-MM";
    recognition.continuous = false;
    recognition.interimResults = false;
    stageRef.current = "question";
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").trim();
      const extracted = extractEllaWakeQuestion(transcript);
      const cleaned = extracted.question || transcript;
      setQuestion(cleaned);
      setIsListening(false);
      stageRef.current = null;
      if (cleaned) {
        setVoiceMessage("အဲလာက မေးခွန်းကို ရရှိပါပြီ။");
        ask.mutate({ question: cleaned, date });
      } else {
        setVoiceMessage("မေးခွန်းကို မကြားရသေးပါ။ အဲလာကို ထပ်ခေါ်ပြီး မေးပါ။");
      }
    };
    recognition.onerror = event => {
      setIsListening(false);
      stageRef.current = null;
      setVoiceMessage(event?.error === "not-allowed" ? "Microphone ခွင့်ပြုချက်ပေးပြီး ထပ်စမ်းပါ။" : "အသံကို မကြားရပါ။ ထပ်စမ်းပါ သို့မဟုတ် စာနဲ့မေးပါ။");
    };
    recognition.onend = () => { setIsListening(false); if (stageRef.current === "question") stageRef.current = null; };
    recognitionRef.current = recognition;
    setVoiceMessage("အဲလာက နားထောင်နေပါတယ်။ မေးခွန်းကို ပြောပါ…");
    setIsListening(true);
    recognition.start();
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
    stageRef.current = "wake";
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0]?.transcript || "").join(" ").trim();
      const extracted = extractEllaWakeQuestion(transcript);
      setIsListening(false);
      stageRef.current = null;
      if (extracted.wakeDetected && extracted.question) {
        setQuestion(extracted.question);
        setVoiceMessage("အဲလာက ကြားပါတယ်။");
        speak("ဟုတ်ကဲ့၊ အဲလာ နားထောင်နေပါတယ်။");
        ask.mutate({ question: extracted.question, date });
      } else if (extracted.wakeDetected) {
        setVoiceMessage("ဟုတ်ကဲ့၊ အဲလာ နားထောင်နေပါတယ်။ မေးခွန်းကို ဆက်ပြောပါ…");
        speak("ဟုတ်ကဲ့၊ အဲလာ နားထောင်နေပါတယ်။");
        window.setTimeout(listenForQuestion, 300);
      } else {
        setVoiceMessage("အရင် “အဲလာ” လို့ခေါ်ပြီး မေးခွန်းကို ပြောပါ။");
      }
    };
    recognition.onerror = event => {
      setIsListening(false);
      stageRef.current = null;
      setVoiceMessage(event?.error === "not-allowed" ? "Microphone ခွင့်ပြုချက်ပေးပြီး ထပ်စမ်းပါ။" : "အသံကို မကြားရပါ။ ထပ်စမ်းပါ သို့မဟုတ် စာနဲ့မေးပါ။");
    };
    recognition.onend = () => { setIsListening(false); if (stageRef.current === "wake") stageRef.current = null; };
    recognitionRef.current = recognition;
    setVoiceMessage("အဲလာလို့ခေါ်ပါ…");
    setIsListening(true);
    recognition.start();
  };

  const openAndListen = () => {
    setOpen(true);
    startListening();
  };

  return <>
    <button className="ella-trigger" type="button" onClick={open ? () => setOpen(false) : openAndListen} aria-expanded={open} aria-label="Open Ella read-only assistant">အဲလာ</button>
    {open && <aside className="ella-panel" aria-label="Ella read-only assistant">
      <header className="ella-panel-header"><div><strong>အဲလာ</strong><small>Read-only ERP Assistant · {date}</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close Ella"><X size={16} /></button></header>
      <div className="ella-panel-body"><p className="ella-intro">အဲလာလို့ခေါ်ပြီး မေးခွန်းကို ဆက်ပြောပါ။ Closing, Used, Purchase, Damage နဲ့ Sales စာရင်းတွေကိုသာ ဖတ်ပြနိုင်ပါတယ်။</p>{answer && <div className="ella-answer"><strong>အဖြေ</strong><p>{answer}</p><button type="button" onClick={() => speak(answer)} aria-label="Read answer aloud"><Volume2 size={15} /> အသံနဲ့ဖတ်ရန်</button></div>}{voiceMessage && <p className="ella-voice-status">{voiceMessage}</p>}</div>
      <form className="ella-form" onSubmit={submit}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder="ဥပမာ - အဲလာ၊ ဂျုံ Closing ဘယ်လောက်လဲ?" aria-label="Ask Ella" /><button type="button" onClick={isListening ? () => recognitionRef.current?.stop() : startListening} aria-label={isListening ? "Stop listening" : "Ask by voice"}>{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button><button type="submit" disabled={!question.trim() || ask.isPending} aria-label="Send question"><Send size={16} /></button></form>
    </aside>}
  </>;
}
