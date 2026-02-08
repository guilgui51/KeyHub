import common from "./common.json";
import dates from "./dates.json";
import menu from "./menu.json";
import fields from "./fields.json";
import enums from "./enum.json";
import lists from "./lists.json";
import actions from "./actions.json";
import errors from "./errors.json";
import imports from "./imports.json";
import {Ns} from "../../components-shared/translations/ns.enum";

export default {
    [Ns.Common]: common,
    [Ns.Dates]: dates,
    [Ns.Menu]: menu,
    [Ns.Fields]: fields,
    [Ns.Enums]: enums,
    [Ns.Lists]: lists,
    [Ns.Imports]: imports,

    [Ns.Actions]: actions,
    [Ns.Errors]: errors
}