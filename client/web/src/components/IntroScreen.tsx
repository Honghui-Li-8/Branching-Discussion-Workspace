export const IntroScreen = () => {
  return (
    <section className="flex h-auto min-h-[430px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:h-[calc(100vh-32px)] lg:min-h-0">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Trellis
      </p>
      <h1 className="my-[14px] max-w-[760px] text-[clamp(28px,4vw,44px)] font-semibold leading-[1.1] text-slate-950">
        Start by opening or creating a workspace
      </h1>
      <p className="m-0 max-w-[620px] text-slate-600">
        This area will switch to a brainstorm-style tree canvas once a workspace is
        selected.
      </p>
    </section>
  )
}
