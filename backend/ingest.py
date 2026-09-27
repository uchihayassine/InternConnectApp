import math
import os
import sys

import google.generativeai as genai
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

EMBED_MODEL = "models/gemini-embedding-001"
EMBED_DIM = 768

DOCUMENTS = [
    {
        "title": "FH Dortmund library location",
        "topic": "library",
        "content": (
            "The main Fachhochschule Dortmund library (Bibliothek+) is at Emil-Figge-Straße 44, "
            "44227 Dortmund, in the north wing on the 2nd and 3rd floors. The library phone is "
            "+49 231 9112-4917. Take the stairs or lift in the Emil-Figge-Straße 44 building to "
            "the north wing. A book-return machine sits in the entrance area and can be used while "
            "the building is open, usually from about 07:00 to 22:00, even when the service desk is closed. "
            "Students need a campus account for borrowing, and staff can register or renew an account "
            "only during staffed service hours."
        ),
    },
    {
        "title": "Library study spaces and opening hours",
        "topic": "library",
        "content": (
            "Study space at the Emil-Figge-Straße 44 library includes individual desks on the 2nd and 3rd floors, "
            "a parent-and-child desk and a workstation for blind and visually impaired students on the 2nd floor, "
            "a soundproof phone booth, research PCs, Wi-Fi via VPN, USB book scanners, and lockers. "
            "During the lecture period the published service hours are Monday to Thursday 08:00-17:00, "
            "Friday 08:00-15:00, and Saturday 10:00-13:30. During the semester break from 1 August to 26 September "
            "the service hours are Monday to Thursday 08:00-16:00 and Friday 08:00-15:00, and the library is closed on Saturday. "
            "Staffed services such as lending advice, payments, interlibrary loan, course reserves, and laptop loans "
            "are available only during those service hours. Always check the Bibliothek+ page before you travel, "
            "because holiday weeks can differ."
        ),
    },
    {
        "title": "International Office consultation desk",
        "topic": "international-office",
        "content": (
            "The International Office is the first stop for international applicants and enrolled students at "
            "Fachhochschule Dortmund. The desk is at Joseph-von-Fraunhofer-Straße 23, 44227 Dortmund. "
            "Email international-office@fh-dortmund.de for application and enrollment questions. "
            "Walk-in consultation is on Thursday from 09:30 to 12:30 and from 13:30 to 15:30. "
            "Monday 09:30-12:30 and Wednesday 09:30-12:30 and 13:30-15:30 are by appointment only. "
            "Book a Monday or Wednesday appointment in advance by email or phone and include the reason for the visit. "
            "The building porter at Joseph-von-Fraunhofer-Straße 23 is on duty Monday to Friday from 06:00 to 20:00."
        ),
    },
    {
        "title": "Ruhrbahn, VRR, and the semester ticket",
        "topic": "transit",
        "content": (
            "Local buses and trams in Dortmund are run by Ruhrbahn and sit inside the VRR tariff. "
            "The Emil-Figge-Straße campus and the Sonnenstraße campus are reached by Ruhrbahn stops near each site; "
            "use the stop name shown in the VRR or Ruhrbahn app rather than walking from the main station. "
            "The semester contribution for Fachhochschule Dortmund students includes a semester ticket for public transport. "
            "Carry your student ID together with the current semester validation. The ticket covers local and regional "
            "transport such as Ruhrbahn buses, trams, and VRR regional trains. It does not cover long-distance ICE or IC trains. "
            "The exact area, whether NRW-only or a Deutschlandsemesterticket, can change by semester. "
            "Confirm the current rules with the AStA of Fachhochschule Dortmund or on the VRR website before a long trip. "
            "Inspectors can fine you if the ticket or student ID is missing, so keep both with you."
        ),
    },
    {
        "title": "Campus emergency contacts and security",
        "topic": "emergency",
        "content": (
            "For a medical emergency, fire, or any danger to life, call 112. For the police, call 110. "
            "These numbers work from any phone in Germany and do not need a country code. "
            "On campus, the building porter (Pförtner) is the on-site security contact. "
            "Emil-Figge-Straße buildings are staffed Monday to Saturday from 07:00 to 22:00. "
            "Email pfoertner-efs@fh-dortmund.de or call the published extension +49 231 9112-4933 for Emil-Figge-Straße 44. "
            "Sonnenstraße 96 porter: pfoertner-son@fh-dortmund.de. "
            "Max-Ophüls-Platz 2 porter: pfoertner-mop@fh-dortmund.de. "
            "Joseph-von-Fraunhofer-Straße 23 porter: pfoertner-jvf@fh-dortmund.de, Monday to Friday 06:00-20:00. "
            "Tell the porter your building, floor, and what happened. The university is closed from 24 December through 1 January."
        ),
    },
    {
        "title": "Campus buildings and how to find a room",
        "topic": "navigation",
        "content": (
            "Fachhochschule Dortmund has several sites. Emil-Figge-Straße 40, 42, and 44 are in Dortmund-Barop, postal code 44227. "
            "The library is in building 44, north wing, floors 2 and 3. Sonnenstraße 96 and Max-Ophüls-Platz 2 are the city-center sites. "
            "The International Office is at Joseph-von-Fraunhofer-Straße 23, also in 44227 Dortmund. "
            "Room numbers are posted by the lifts. A room such as 402 is on the 4th floor of the building named in your timetable, "
            "not automatically in every Emil-Figge building. Match the street number in your course schedule (40, 42, or 44) "
            "before you enter. Building doors are generally open Monday to Saturday from 07:00 to 22:00, except Joseph-von-Fraunhofer-Straße, "
            "which is open Monday to Friday from 06:00 to 20:00."
        ),
    },
    {
        "title": "Arrival, enrollment, and who to email",
        "topic": "student-services",
        "content": (
            "New international students should write to international-office@fh-dortmund.de about admission, visa letters, "
            "and enrollment at Fachhochschule Dortmund. Include your applicant number and the study program. "
            "Enrolled students who need a certificate of enrollment or a change of address use the student service process "
            "described in the campus portal, and can ask the International Office during Thursday open hours if the portal is unclear. "
            "Bring your passport, admission letter, and proof of health insurance to an in-person enrollment appointment. "
            "The open consultation desk is only on Thursday at Joseph-von-Fraunhofer-Straße 23. Other weekdays need an appointment. "
            "Do not send passport scans to a personal staff email; use the International Office address above."
        ),
    },
]


def chunk_text(text: str, target: int = 800) -> list[str]:
    text = " ".join(text.split())
    if len(text) <= 1000:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + target)
        if end < len(text):
            split_at = text.rfind(". ", start + 500, end)
            if split_at != -1:
                end = split_at + 1
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = end
    return chunks


def normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def embed_document(text: str) -> list[float]:
    result = genai.embed_content(
        model=EMBED_MODEL,
        content=text,
        task_type="retrieval_document",
        output_dimensionality=EMBED_DIM,
    )
    vector = result["embedding"]
    if len(vector) != EMBED_DIM:
        raise RuntimeError(f"Expected {EMBED_DIM} dimensions, got {len(vector)}")
    return normalize(vector)


def supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key or url.startswith("your_") or key.startswith("your_"):
        print(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env before running ingest.py.",
            file=sys.stderr,
        )
        sys.exit(1)
    return create_client(url, key)


def main() -> None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is missing from backend/.env.", file=sys.stderr)
        sys.exit(1)
    genai.configure(api_key=api_key)
    client = supabase_client()

    rows = []
    for document in DOCUMENTS:
        pieces = chunk_text(document["content"])
        for index, piece in enumerate(pieces, start=1):
            rows.append(
                {
                    "content": piece,
                    "metadata": {
                        "title": document["title"],
                        "topic": document["topic"],
                        "chunk": index,
                        "chunks": len(pieces),
                    },
                    "embedding": embed_document(piece),
                }
            )

    client.table("campus_documents").delete().gte("id", 0).execute()
    client.table("campus_documents").insert(rows).execute()
    print(f"Inserted {len(rows)} rows into campus_documents.")


if __name__ == "__main__":
    main()
