import type { FieldValues, UseFormRegister } from "react-hook-form";
import React from "react";

type NameInputProps = {
    label: string;
    name: string;
    register: UseFormRegister<FieldValues>;
    errors: UseFormState<FieldValues>["errors"];
}

const NameInput: React.FC<NameInputProps> = ({label, name, register, errors}) => {
  return (
    <div>
        <label htmlFor={name} className="label">
            <span className="label-text">
                {label}
                <span className="text-error">*</span>
            </span>
        </label>

        <input id={name} type="text" className="input input-bordered" {...register(name)} />
        {errors[name] && <div className="error">Error message for {label}</div>}
    </div>
  )
}

export default NameInput