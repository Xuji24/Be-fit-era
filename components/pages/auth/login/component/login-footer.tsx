export default function LoginFooter() {
  return (
    <footer className="w-full flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 py-3 text-xs text-foreground/40 dark:text-foreground/30 font-merriweather-sans">
      <p>Copyright &copy; 2026 Be Fit ERA</p>
      <a
        href="#"
        className="hover:text-[var(--brand)] transition-colors underline underline-offset-2"
      >
        Privacy Policy
      </a>
    </footer>
  );
}
