type AdminDataFailure = {
  status: 429 | 500 | 503;
  message: string;
};

function getErrorCode(reason: unknown) {
  return typeof reason === "object" && reason !== null && "code" in reason
    ? String(reason.code).toUpperCase().replaceAll("_", "-")
    : "";
}

function getErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "";
}

export function getFirebaseAdminDataFailure(reason: unknown, fallback: string): AdminDataFailure {
  const code = getErrorCode(reason);
  const message = getErrorMessage(reason);

  if (["8", "429", "RESOURCE-EXHAUSTED"].includes(code) ||
      /RESOURCE_EXHAUSTED|quota exceeded/i.test(message)) {
    return {
      status: 429,
      message: "Firestore is temporarily rate-limited (read quota exceeded). Check Firebase usage and billing limits, then try again.",
    };
  }
  if (code === "7" || code === "PERMISSION-DENIED" || /PERMISSION_DENIED/i.test(message)) {
    return {
      status: 503,
      message: "The Firebase Admin service account cannot access Firestore. Check its IAM permissions for this project.",
    };
  }
  if (/could not load the default credentials|default credentials|configure FIREBASE_PROJECT_ID|FIREBASE_CLIENT_EMAIL|FIREBASE_PRIVATE_KEY|invalid_grant/i.test(message)) {
    return {
      status: 503,
      message: "Firebase Admin credentials are missing or invalid in the hosting environment. Configure the Firebase service-account variables and redeploy.",
    };
  }
  if (code === "9" || code === "FAILED-PRECONDITION" || /FAILED_PRECONDITION|requires an index|index.*required/i.test(message)) {
    return {
      status: 500,
      message: "Firestore rejected this query configuration. Check the server logs and required Firestore indexes.",
    };
  }
  if (["4", "10", "14", "DEADLINE-EXCEEDED", "ABORTED", "UNAVAILABLE"].includes(code) ||
      /DEADLINE_EXCEEDED|UNAVAILABLE/i.test(message)) {
    return {
      status: 503,
      message: "Firestore is temporarily unavailable. Please try again shortly.",
    };
  }

  return { status: 500, message: fallback };
}
