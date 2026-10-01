import dragonfly from "@/assets/mascots/dragonfly.webp";
import jaguar from "@/assets/mascots/jaguar.webp";
import octopus from "@/assets/mascots/octopus.webp";
import raccoon from "@/assets/mascots/raccoon_walk.webp";

/**
 * Decorative mascots that wander around behind the sign-in form.
 *
 * The webp files are already animated in place (the jaguar's run cycle, the
 * dragonfly's wings, the raccoon's walk), so all this layer does is move them
 * around the page: the jaguar sprints the full width and turns around
 * off-screen, the dragonfly flits about overhead, and the octopus and raccoon
 * wander their own stretch of floor. Each one covers real ground rather than
 * rocking in place, on periods long enough that they never fall into step with
 * each other. Keyframes live in `src/index.css` under "Login mascots".
 *
 * They are kept small — pet-sized rather than poster-sized. On phones the form
 * takes up nearly the whole width, so they stay in the bands above and below it
 * and roam mostly sideways; from `md` up, where there is room either side of
 * the form, they spread out and the roaming opens up. The layer is inert
 * (`pointer-events-none`), hidden from assistive tech, and dropped entirely
 * under `prefers-reduced-motion` or on a viewport too short to spare the room.
 */
export default function MascotField() {
  return (
    <div
      aria-hidden
      className="mascot-field pointer-events-none absolute inset-0 z-[25] overflow-hidden select-none"
    >
      {/* Jaguar — sprints across the bottom, waits off-screen, sprints back */}
      <img
        src={jaguar}
        alt=""
        draggable={false}
        className="mascot-dash absolute bottom-[4%] left-0 w-[84px] md:bottom-[9%] md:w-[124px] lg:w-[152px]"
      />

      {/* Dragonfly — flits across the top, never quite settling */}
      <div className="mascot-roam absolute top-[2%] right-[6%] w-[46px] [--mascot-delay:-3s] [--mascot-duration:18s] [--roam-x:calc(clamp(40px,26vw,160px)*-1)] [--roam-y:clamp(10px,3vh,30px)] md:top-[15%] md:right-[8%] md:w-[68px] md:[--roam-x:calc(clamp(60px,10vw,180px)*-1)] md:[--roam-y:clamp(30px,8vh,90px)]">
        <img
          src={dragonfly}
          alt=""
          draggable={false}
          className="mascot-hover w-full [--float:9px] [--mascot-bounce-duration:5.5s] md:[--float:14px]"
        />
      </div>

      {/* Octopus — waddles the long way around its own patch of floor */}
      <div className="mascot-roam absolute right-[4%] bottom-[3%] w-[44px] [--mascot-delay:-11s] [--mascot-duration:26s] [--roam-x:calc(clamp(40px,24vw,150px)*-1)] [--roam-y:calc(clamp(6px,1.5vh,18px)*-1)] md:top-[30%] md:right-auto md:bottom-auto md:left-[8%] md:w-[66px] md:[--roam-x:clamp(50px,8vw,140px)] md:[--roam-y:clamp(30px,8vh,90px)]">
        <img
          src={octopus}
          alt=""
          draggable={false}
          className="mascot-waddle w-full [--mascot-bounce-duration:3.4s] [--waddle:7px]"
        />
      </div>

      {/* Raccoon — potters up and down the floor, turning at each end */}
      <div className="mascot-patrol absolute bottom-[4%] left-[4%] w-[42px] [--mascot-delay:-6s] [--patrol:clamp(40px,26vw,150px)] md:bottom-[15%] md:left-auto md:right-[13%] md:w-[62px] md:[--patrol:clamp(60px,10vw,140px)]">
        <img
          src={raccoon}
          alt=""
          draggable={false}
          className="mascot-waddle w-full [--mascot-bounce-delay:-1.2s] [--waddle:6px]"
        />
      </div>
    </div>
  );
}
