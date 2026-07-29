# 💳 Guide: Så här skapar du ett Stripe-konto och hämtar dina API-nycklar

För att kunna ta emot betalningar i GlimmerFall Store (för starter decks och booster boxar) behöver vi integrera Stripe. Följ denna steg-för-steg-guide för att skapa ett konto och hämta de nycklar vi behöver.

## Steg 1: Skapa ett Stripe-konto
1. Gå till [Stripes registreringssida](https://dashboard.stripe.com/register).
2. Fyll i din e-postadress, ditt namn, ditt land (t.ex. Sverige) och ett starkt lösenord.
3. Klicka på **"Create account"** (Skapa konto).
4. Verifiera din e-postadress genom att klicka på länken som Stripe skickar till dig.

## Steg 2: Aktivera ditt konto (Valfritt för testning)
När du först loggar in är du i **Testläge (Test mode)**. Detta är perfekt för att bygga och testa butiken utan att använda riktiga pengar. 
* *Vill du bara testa?* Då kan du hoppa över det här steget och gå direkt till Steg 3.
* *Vill du ta emot riktiga betalningar direkt?* Klicka på knappen **"Activate payments"** (Aktivera betalningar) högst upp på din Stripe Dashboard. 
  * **Du behöver INTE ha ett registrerat företag (AB)!**
  * När Stripe frågar efter "Type of business" (Företagstyp), väljer du bara **"Individual / Sole Proprietorship"** (Enskild firma / Privatperson).
  * Fyll sedan i ditt eget personnummer, din hemadress och ditt privata bankkonto (clearing- och kontonummer) dit pengarna ska betalas ut. Du verifierar dig oftast med ditt körkort eller pass. Det är helt lagligt att driva det som privatperson/enskild firma när man startar!

## Steg 3: Hitta dina API-nycklar
API-nycklarna är det som låter GlimmerFall-projektet prata med din Stripe-användare på ett säkert sätt.

1. I vänstermenyn på din Stripe Dashboard, klicka på **"Developers"** (Utvecklare) och sedan på **"API keys"** (API-nycklar).
   *(Alternativt kan du söka efter "API keys" i sökfältet högst upp).*
2. Här kommer du att se två viktiga nycklar under sektionen "Standard keys":
   
   * **Publishable key:** (Börjar ofta med `pk_test_...` i testläge eller `pk_live_...` i skarpt läge). Denna nyckel används i frontenden (React/Vercel).
   * **Secret key:** (Börjar med `sk_test_...` eller `sk_live_...`). För att se denna måste du klicka på knappen *"Reveal test key"* (eller live key). **Denna nyckel är extremt hemlig och får aldrig delas offentligt.** Den ska enbart ligga i backend-servern.

## Steg 4: Koppla nycklarna till GlimmerFall-projektet

När du har kopierat dina nycklar behöver de läggas in i miljövariablerna (Environment Variables). Eftersom GlimmerFall använder Vercel för frontenden och en egen backend, gör du följande:

### För den lokala utvecklingen (på din dator):
Om du vill att vi ska koda och testa detta lokalt först, ge mig nycklarna (helst test-nycklarna: `pk_test_...` och `sk_test_...`) här i chatten så lägger jag in dem i projektets `.env`-filer:
* I `frontend/.env` som `REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...`
* I `backend/.env` som `STRIPE_SECRET_KEY=sk_test_...`

### För live-sidan på Vercel:
1. Gå till din [Vercel Dashboard](https://vercel.com/dashboard) och klicka på GlimmerFall-projektet.
2. Gå till fliken **Settings** och välj **Environment Variables** i vänstermenyn.
3. Lägg till din *Publishable Key*:
   * **Key:** `REACT_APP_STRIPE_PUBLISHABLE_KEY`
   * **Value:** `pk_live_...` (eller testnyckeln)
4. (Om backend också är hostad på Vercel, lägg även till Secret Key):
   * **Key:** `STRIPE_SECRET_KEY`
   * **Value:** `sk_live_...`
5. Klicka på **Save** och därefter behöver du göra en ny "Redeploy" av projektet för att de nya nycklarna ska aktiveras live.

---
**Är du redo?** Gå in på Stripe, hämta testnycklarna (`pk_test_...` och `sk_test_...`) och klistra in dem här i chatten, så bygger jag ut varukorgen och betalningssystemet åt dig!
