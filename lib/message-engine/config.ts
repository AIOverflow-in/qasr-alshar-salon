export function messageEngineEnabled() {
  return process.env.MESSAGE_ENGINE_ENABLED === "true";
}

export function messageEngineDryRun() {
  return process.env.MESSAGE_ENGINE_DRY_RUN !== "false";
}

export function messageDispatchOwner() {
  return process.env.MESSAGE_ENGINE_DISPATCH_TARGET || "erp";
}

export function isDispatchOwner() {
  if (process.env.NODE_ENV !== "production") return true;
  return (process.env.DEPLOY_TARGET || "") === messageDispatchOwner();
}

export function twilioSender() {
  return process.env.TWILIO_WHATSAPP_FROM || "";
}

export function twilioContentSid() {
  return process.env.TWILIO_VISIT_THANK_YOU_CONTENT_SID || "";
}
