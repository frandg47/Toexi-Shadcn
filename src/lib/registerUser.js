import { supabase } from "./supabaseClient";

export const registerUser = async ({
  name,
  lastName,
  dni,
  phone,
  address,
  email,
  password,
  role = "seller",
  state = false,
}) => {
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    throw new Error(signUpError.message);
  }

  const authUser = signUpData?.user;

  if (!authUser?.id) {
    throw new Error("No fue posible obtener el identificador del usuario");
  }

  const { error: insertError } = await supabase.from("users").insert({
    name,
    last_name: lastName,
    email,
    dni,
    phone,
    adress: address,
    id_auth: authUser.id,
    role,
    state,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { success: true };
};
