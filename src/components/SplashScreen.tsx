import { useEffect, useState } from "react";
import "./SplashScreen.css";

const brandName = "CRYPTAVISTA";

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setIsVisible(false), 3900);
    return () => window.clearTimeout(hideTimer);
  }, []);

  return (
    <div className={`splash-screen${isVisible ? "" : " splash-screen--hidden"}`} aria-hidden="true">
      <div className="splash-screen__grid" />
      <div className="splash-screen__content">
        <div className="splash-screen__logo-orbit">
          <img className="splash-screen__logo" src="/logo.png" alt="" />
        </div>
        <div className="splash-screen__wordmark">
          {brandName.split("").map((letter, index) => (
            <span key={`${letter}-${index}`} style={{ animationDelay: `${1.65 + index * 0.09}s` }}>
              {letter}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}