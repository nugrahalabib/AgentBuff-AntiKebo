// Monitor tambahan saat alarm berbunyi: gelap, menunjuk ke layar utama (docs/09 §6 butir 5).
"use strict";
AK.panggil("layar_alarm").then((a) => {
  AK.aturBahasa(a.bahasa);
  AK.terjemahkan();
});
AK.terjemahkan();
