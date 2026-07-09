// Heuristic guardrail against accidental PHI entry in free-text fields
// (request notes, delay notes). Mirrors server/src/utils/phiDetection.ts — the
// client blocks obvious identifiers before submit for fast feedback, and the
// server enforces the same rules so the check can't be bypassed. Names are NOT
// reliably detectable, so the UI also warns the user not to enter them.

export interface PhiScanResult {
  flagged: boolean;
  reason?: string;
}

// A run of 6+ consecutive digits — MRN / account / patient-ID territory.
// Room numbers are 3-4 digits, so legitimate transport data does not trip this.
const LONG_NUMBER = /\d{6,}/;
// Social Security number: 123-45-6789 or 123 45 6789
const SSN = /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/;
// Explicit medical-record / patient-ID callouts followed by a number
const LABELLED_ID = /\b(mrn|medical record|record number|acct|account|patient id|pt id|dob|date of birth)\b[:#\s]*\d/i;
// Date of birth style dates: 1/2/1990, 01-02-90, etc.
const DATE_LIKE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;

const REMOVE = 'Please remove any patient identifiers before saving.';

export const detectPhi = (text: string | null | undefined): PhiScanResult => {
  if (!text) return { flagged: false };
  if (SSN.test(text)) {
    return { flagged: true, reason: `This looks like a Social Security number. ${REMOVE}` };
  }
  if (LABELLED_ID.test(text)) {
    return { flagged: true, reason: `This looks like a medical record number or patient ID. ${REMOVE}` };
  }
  if (LONG_NUMBER.test(text)) {
    return { flagged: true, reason: `This contains a long number that may be an MRN or account number. ${REMOVE}` };
  }
  if (DATE_LIKE.test(text)) {
    return { flagged: true, reason: `This looks like a date of birth. ${REMOVE}` };
  }
  return { flagged: false };
};
