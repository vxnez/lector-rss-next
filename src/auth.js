// src/auth.js
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db, ensureBienvenidaSchema } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      authorization: {
        params: {
          prompt: "select_account", // Fuerza el selector de cuenta de GitHub en cada inicio de sesión
        },
      },
    }),
    Credentials({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Buscar usuario en Aiven MySQL
        const [rows] = await db.query("SELECT * FROM usuarios WHERE email = ?", [credentials.email]);
        const user = rows[0];

        if (!user || !user.password_hash) return null;

        // Validar contraseña encriptada
        const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash);
        if (!passwordMatch) return null;

        return { id: user.id.toString(), name: user.nombre, email: user.email, image: user.imagen_url };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Registro automático y vinculación para Google y GitHub: si el correo
      // ya existe (p. ej. cuenta de correo+contraseña), se vincula el
      // proveedor a la misma cuenta en vez de crear un duplicado.
      if (account?.provider === "google" || account?.provider === "github") {
        try {
          try {
            await ensureBienvenidaSchema();
          } catch {
            // Si la columna no se pudo crear, se sigue con el flujo anterior.
          }
          const [existingUsers] = await db.query("SELECT * FROM usuarios WHERE email = ?", [user.email]);

          if (existingUsers.length === 0) {
            await db.query(
              "INSERT INTO usuarios (nombre, email, imagen_url, proveedor) VALUES (?, ?, ?, ?)",
              [user.name, user.email, user.image, account.provider]
            );
            // Cuenta nueva por OAuth: la bienvenida queda pendiente (DEFAULT 0).
          } else {
            const actuales = String(existingUsers[0].proveedor || "")
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);
            if (!actuales.includes(account.provider)) {
              // Primera vez que esta cuenta usa este proveedor OAuth: se
              // vincula y se reactiva la bienvenida aunque el correo ya
              // existiera (el localStorage por email la ocultaría si no).
              try {
                await db.query("UPDATE usuarios SET proveedor = ?, bienvenida_vista = 0 WHERE id = ?", [
                  [...actuales, account.provider].join(","),
                  existingUsers[0].id,
                ]);
              } catch (error) {
                if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
                await db.query("UPDATE usuarios SET proveedor = ? WHERE id = ?", [
                  [...actuales, account.provider].join(","),
                  existingUsers[0].id,
                ]);
              }
            }
          }
        } catch (error) {
          console.error("Error al guardar usuario OAuth:", error);
          return false;
        }
      }
      return true;
    },
    async session({ session }) {
      if (session?.user?.email) {
        try {
          try {
            await ensureBienvenidaSchema();
          } catch {
            // Sin la columna se usa el comportamiento anterior (solo localStorage).
          }
          let rows;
          try {
            [rows] = await db.query(
              "SELECT id, nombre, imagen_url, genero, bienvenida_vista FROM usuarios WHERE email = ?",
              [session.user.email]
            );
          } catch (error) {
            if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
            [rows] = await db.query(
              "SELECT id, nombre, imagen_url FROM usuarios WHERE email = ?",
              [session.user.email]
            );
          }
          if (rows[0]) {
            session.user.id = rows[0].id;
            if (rows[0].nombre) session.user.name = rows[0].nombre;
            session.user.image = rows[0].imagen_url || session.user.image || null;
            session.user.genero = rows[0].genero || null;
            // 0 = mostrar bienvenida (primer login OAuth o cuenta nueva);
            // 1 o ausente = respetar solo el localStorage.
            session.user.bienvenidaVista = rows[0].bienvenida_vista ?? 1;
          }
        } catch (error) {
          console.error("Error al resolver la sesión:", error.message);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});