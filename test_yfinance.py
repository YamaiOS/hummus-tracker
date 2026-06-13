import yfinance as yf
from datetime import datetime, timedelta

def get_month_code(date):
    # F(Jan), G(Feb), H(Mar), J(Apr), K(May), M(Jun), N(Jul), Q(Aug), U(Sep), V(Oct), X(Nov), Z(Dec)
    codes = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z']
    return codes[date.month - 1]

def test_symbols():
    now = datetime.now()
    # M1 is usually the next month's contract for oil
    m1_date = now + timedelta(days=32)
    m2_date = now + timedelta(days=62)
    m6_date = now + timedelta(days=182)
    
    dates = {"M1": m1_date, "M2": m2_date, "M6": m6_date}
    
    for label, d in dates.items():
        code = get_month_code(d)
        year = str(d.year)[2:]
        # ICE Brent on Yahoo Finance is often BZ=F (front) or BZ<code><year>.NYM
        brent_sym = f"BZ{code}{year}.NYM"
        # Dubai is harder on Yahoo. Sometimes DUB=F or ODB<code><year>.NYM
        dubai_sym = f"DUB{code}{year}.CME" 
        
        print(f"{label} ({code}{year}): Brent={brent_sym}, Dubai={dubai_sym}")
        
        brent = yf.Ticker(brent_sym).history(period="1d")
        dubai = yf.Ticker(dubai_sym).history(period="1d")
        
        b_price = brent['Close'].iloc[-1] if not brent.empty else "N/A"
        d_price = dubai['Close'].iloc[-1] if not dubai.empty else "N/A"
        
        print(f"  Prices: Brent={b_price}, Dubai={d_price}")

if __name__ == "__main__":
    # Front month shortcuts
    print("Front Month (BZ=F):", yf.Ticker("BZ=F").history(period="1d")['Close'].iloc[-1])
    # Dubai front month proxy?
    print("Dubai Front (DUB=F):", yf.Ticker("DUB=F").history(period="1d")['Close'].iloc[-1])
    test_symbols()
